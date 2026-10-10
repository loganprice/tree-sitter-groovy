package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	tree_sitter_groovy "github.com/loganprice/tree-sitter-groovy/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

// Step represents a step invoked within a Jenkins pipeline.
type Step struct {
	Name      string `json:"name"`
	Stage     string `json:"stage"`
	Container string `json:"container,omitempty"`
	Args      string `json:"args,omitempty"`
	Line      uint   `json:"line"`
	Column    uint   `json:"column"`
	IsBlock   bool   `json:"is_block"`
}

// PipelineReport represents the complete analysis report for a Jenkinsfile.
type PipelineReport struct {
	File         string   `json:"file"`
	PipelineType string   `json:"pipeline_type"`
	PodLabel     string   `json:"pod_label,omitempty"`
	PodName      string   `json:"pod_name,omitempty"`
	Containers   []string `json:"containers,omitempty"`
	Steps        []Step   `json:"steps"`
}

// Structural keywords that define pipeline layout rather than executable steps.
var structuralKeywords = map[string]bool{
	"pipeline":    true,
	"agent":       true,
	"stages":      true,
	"stage":       true,
	"steps":       true,
	"post":        true,
	"environment": true,
	"options":     true,
	"parameters":  true,
	"triggers":    true,
	"tools":       true,
	"when":        true,
	"node":        true,
	"podTemplate": true,
}

// cleanString strips surrounding single or double quotes and whitespace.
func cleanString(raw string) string {
	raw = strings.TrimSpace(raw)
	if (strings.HasPrefix(raw, "'") && strings.HasSuffix(raw, "'")) ||
		(strings.HasPrefix(raw, "\"") && strings.HasSuffix(raw, "\"")) {
		if len(raw) >= 2 {
			return raw[1 : len(raw)-1]
		}
	}
	return raw
}

// cleanArgs formats the arguments for compact single-line display.
func cleanArgs(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.ReplaceAll(raw, "\n", " ")
	raw = strings.Join(strings.Fields(raw), " ")
	return raw
}

// extractFirstArgString gets the string literal value of the first argument.
func extractFirstArgString(argsNode *tree_sitter.Node, src []byte) string {
	if argsNode == nil {
		return ""
	}
	for i := uint(0); i < argsNode.NamedChildCount(); i++ {
		child := argsNode.NamedChild(i)
		if child == nil {
			continue
		}
		if child.Kind() == "named_argument" {
			val := child.ChildByFieldName("value")
			if val != nil {
				return cleanString(val.Utf8Text(src))
			}
		}
		return cleanString(child.Utf8Text(src))
	}
	return ""
}

// EnclosingContext holds stage and container metadata discovered by walking up the AST.
type EnclosingContext struct {
	Stage        string
	Container    string
	InValidScope bool
}

// resolveEnclosingContext walks up the AST from a candidate step node to find its stage and container.
func resolveEnclosingContext(node *tree_sitter.Node, src []byte) EnclosingContext {
	ctx := EnclosingContext{}

	for curr := node.Parent(); curr != nil; curr = curr.Parent() {
		kind := curr.Kind()

		// 1. Enclosing container(...) step
		if kind == "method_call" && ctx.Container == "" {
			fnNode := curr.ChildByFieldName("function")
			if fnNode != nil && fnNode.Utf8Text(src) == "container" {
				argsNode := curr.ChildByFieldName("arguments")
				ctx.Container = extractFirstArgString(argsNode, src)
			}
		}

		// 2. Enclosing stage('...') method call
		if kind == "method_call" && ctx.Stage == "" {
			fnNode := curr.ChildByFieldName("function")
			if fnNode != nil && fnNode.Utf8Text(src) == "stage" {
				argsNode := curr.ChildByFieldName("arguments")
				ctx.Stage = extractFirstArgString(argsNode, src)
				ctx.InValidScope = true
			}
		}

		// 3. Post condition block (post { always { ... }, failure { ... } })
		if kind == "closure_call_expression" && ctx.Stage == "" {
			parent := curr.Parent()
			if parent != nil && parent.Kind() == "expression_statement" {
				grandParent := parent.Parent()
				if grandParent != nil && grandParent.Kind() == "closure" {
					postBlock := grandParent.Parent()
					if postBlock != nil && postBlock.Kind() == "closure_call_expression" {
						fnNode := postBlock.ChildByFieldName("function")
						if fnNode != nil && fnNode.Utf8Text(src) == "post" {
							condFn := curr.ChildByFieldName("function")
							if condFn != nil {
								ctx.Stage = "post: " + condFn.Utf8Text(src)
								ctx.InValidScope = true
							}
						}
					}
				}
			}
		}

		// 4. Declarative `steps { ... }` block
		if kind == "closure_call_expression" {
			fnNode := curr.ChildByFieldName("function")
			if fnNode != nil && fnNode.Utf8Text(src) == "steps" {
				ctx.InValidScope = true
			}
		}

		// 5. Scripted `node(...) { ... }` block
		if kind == "method_call" {
			fnNode := curr.ChildByFieldName("function")
			if fnNode != nil && fnNode.Utf8Text(src) == "node" {
				ctx.InValidScope = true
				if ctx.Stage == "" {
					ctx.Stage = "(node)"
				}
			}
		}
	}

	return ctx
}

// cleanContainerName strips parentheses and quotes from a container name.
func cleanContainerName(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "(")
	raw = strings.TrimSuffix(raw, ")")
	return cleanString(raw)
}

// detectPipelineInfo analyzes the AST and source to identify pipeline style and Kubernetes details.
func detectPipelineInfo(lang *tree_sitter.Language, root *tree_sitter.Node, src []byte) (string, string, string, []string) {
	srcStr := string(src)
	isDeclarative := strings.Contains(srcStr, "pipeline {") || strings.Contains(srcStr, "pipeline{")
	isKubernetes := strings.Contains(srcStr, "kubernetes") || strings.Contains(srcStr, "podTemplate")

	pipelineType := "Scripted"
	if isDeclarative {
		pipelineType = "Declarative"
	}
	if isKubernetes {
		pipelineType += " (Kubernetes)"
	}

	var podName, podLabel string
	var containers []string

	// Check for podTemplate(...) in scripted pipeline
	podTemplateQueryStr := `
(method_call
  function: (identifier) @_fn (#eq? @_fn "podTemplate")
  arguments: (argument_list
    (named_argument
      name: (identifier) @arg_name
      value: (_) @arg_val)))
`
	if q, err := tree_sitter.NewQuery(lang, podTemplateQueryStr); err == nil {
		defer q.Close()
		qc := tree_sitter.NewQueryCursor()
		defer qc.Close()
		matches := qc.Matches(q, root, src)
		for {
			m := matches.Next()
			if m == nil {
				break
			}
			var key, val string
			for _, c := range m.Captures {
				switch q.CaptureNames()[c.Index] {
				case "arg_name":
					key = c.Node.Utf8Text(src)
				case "arg_val":
					val = cleanString(c.Node.Utf8Text(src))
				}
			}
			switch key {
			case "name":
				podName = val
			case "label":
				podLabel = val
			}
		}
	}

	// Extract container names from yaml in podTemplate or declarative agent
	yamlRe := regexp.MustCompile(`(?m)^\s*-\s*name:\s*([a-zA-Z0-9_-]+)`)
	matches := yamlRe.FindAllStringSubmatch(srcStr, -1)
	seenContainers := make(map[string]bool)
	for _, m := range matches {
		if len(m) > 1 && !seenContainers[m[1]] {
			seenContainers[m[1]] = true
			containers = append(containers, m[1])
		}
	}

	sort.Strings(containers)
	return pipelineType, podName, podLabel, containers
}

// AnalyzeJenkinsfile parses the Jenkinsfile content and extracts all steps with stage and container context.
func AnalyzeJenkinsfile(filePath string, src []byte) (*PipelineReport, error) {
	lang := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	if lang == nil {
		return nil, fmt.Errorf("failed to load tree-sitter Groovy language")
	}

	parser := tree_sitter.NewParser()
	defer parser.Close()

	if err := parser.SetLanguage(lang); err != nil {
		return nil, fmt.Errorf("failed to set parser language: %w", err)
	}

	tree := parser.Parse(src, nil)
	if tree == nil {
		return nil, fmt.Errorf("failed to parse Jenkinsfile")
	}
	defer tree.Close()

	root := tree.RootNode()

	pipelineType, podName, podLabel, containers := detectPipelineInfo(lang, root, src)

	// Query for all candidate step invocations:
	// - command_expression: e.g. sh 'make', echo 'hello', git url: '...'
	// - method_call: e.g. container('golang') { ... }, junit('...'), cleanWs()
	// - closure_call_expression: e.g. script { ... }
	stepQueryStr := `
[
  (command_expression
    function: (identifier) @step_name
    arguments: (command_argument_list)? @step_args
    closure: (closure)? @step_closure)
  (method_call
    function: (identifier) @step_name
    arguments: (argument_list)? @step_args
    closure: (closure)? @step_closure)
  (closure_call_expression
    function: (identifier) @step_name
    closure: (closure) @step_closure)
] @step
`
	stepQuery, err := tree_sitter.NewQuery(lang, stepQueryStr)
	if err != nil {
		return nil, fmt.Errorf("failed to compile step query: %w", err)
	}
	defer stepQuery.Close()

	qc := tree_sitter.NewQueryCursor()
	defer qc.Close()

	matches := qc.Matches(stepQuery, root, src)
	var steps []Step
	seen := make(map[uintptr]bool)

	for {
		m := matches.Next()
		if m == nil {
			break
		}

		var name, args string
		var startPoint tree_sitter.Point
		var hasClosure bool
		var stepNode tree_sitter.Node

		for _, c := range m.Captures {
			cName := stepQuery.CaptureNames()[c.Index]
			switch cName {
			case "step":
				stepNode = c.Node
			case "step_name":
				name = c.Node.Utf8Text(src)
				startPoint = c.Node.StartPosition()
			case "step_args":
				args = cleanArgs(c.Node.Utf8Text(src))
			case "step_closure":
				hasClosure = true
			}
		}

		// Filter structural non-steps or duplicate matches
		if name == "" || structuralKeywords[name] || seen[stepNode.Id()] {
			continue
		}

		// Walk ancestors to identify enclosing Stage, Container, and valid execution scope
		ctx := resolveEnclosingContext(&stepNode, src)
		if !ctx.InValidScope {
			continue
		}

		seen[stepNode.Id()] = true

		// If this is a `container(...)` step itself, its container target is its argument
		targetContainer := ctx.Container
		if name == "container" && targetContainer == "" {
			targetContainer = cleanContainerName(args)
		}

		steps = append(steps, Step{
			Name:      name,
			Stage:     ctx.Stage,
			Container: targetContainer,
			Args:      args,
			Line:      startPoint.Row + 1,
			Column:    startPoint.Column + 1,
			IsBlock:   hasClosure,
		})
	}

	return &PipelineReport{
		File:         filePath,
		PipelineType: pipelineType,
		PodName:      podName,
		PodLabel:     podLabel,
		Containers:   containers,
		Steps:        steps,
	}, nil
}

// printReport formats and prints the pipeline report to stdout.
func printReport(report *PipelineReport) {
	fmt.Println(strings.Repeat("=", 88))
	fmt.Printf("File:          %s\n", report.File)
	fmt.Printf("Pipeline Type: %s\n", report.PipelineType)
	if report.PodName != "" || report.PodLabel != "" {
		fmt.Printf("Pod Info:      name=%q, label=%q\n", report.PodName, report.PodLabel)
	}
	if len(report.Containers) > 0 {
		fmt.Printf("Containers:    %s\n", strings.Join(report.Containers, ", "))
	}
	fmt.Printf("Total Steps:   %d\n", len(report.Steps))
	fmt.Println(strings.Repeat("=", 88))

	fmt.Printf("%-24s %-12s %-14s %-9s %-7s %s\n", "STAGE", "CONTAINER", "STEP", "LINE:COL", "BLOCK?", "ARGUMENTS")
	fmt.Println(strings.Repeat("-", 88))

	for _, s := range report.Steps {
		containerStr := s.Container
		if containerStr == "" {
			containerStr = "-"
		}
		blockStr := "no"
		if s.IsBlock {
			blockStr = "yes"
		}
		posStr := fmt.Sprintf("%d:%d", s.Line, s.Column)
		args := s.Args
		if len(args) > 30 {
			args = args[:27] + "..."
		}
		fmt.Printf("%-24s %-12s %-14s %-9s %-7s %s\n", s.Stage, containerStr, s.Name, posStr, blockStr, args)
	}
	fmt.Println()
}

func main() {
	jsonOutput := flag.Bool("json", false, "Output results in JSON format")
	flag.Parse()

	var files []string
	if flag.NArg() > 0 {
		files = flag.Args()
	} else {
		// Default to testing both declarative and scripted Kubernetes examples
		candidates := []string{
			"examples/jenkins_steps/Jenkinsfile.declarative",
			"examples/jenkins_steps/Jenkinsfile.scripted",
			"examples/jenkins_steps/Jenkinsfile",
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				files = append(files, c)
			}
		}
	}

	if len(files) == 0 {
		fmt.Fprintln(os.Stderr, "No Jenkinsfile found to analyze.")
		os.Exit(1)
	}

	var reports []*PipelineReport
	for _, f := range files {
		content, err := os.ReadFile(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file %s: %v\n", f, err)
			continue
		}

		report, err := AnalyzeJenkinsfile(filepath.Base(f), content)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error analyzing file %s: %v\n", f, err)
			continue
		}
		reports = append(reports, report)
	}

	if *jsonOutput {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(reports); err != nil {
			fmt.Fprintf(os.Stderr, "Error encoding JSON: %v\n", err)
			os.Exit(1)
		}
		return
	}

	for _, r := range reports {
		printReport(r)
	}
}
