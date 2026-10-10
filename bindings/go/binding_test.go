package tree_sitter_groovy_test

import (
	"testing"

	tree_sitter_groovy "github.com/loganprice/tree-sitter-groovy/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	if language == nil {
		t.Errorf("Error loading Groovy grammar")
	}
}

func TestQueryJenkinsSteps(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_groovy.Language())
	parser := tree_sitter.NewParser()
	defer parser.Close()
	if err := parser.SetLanguage(language); err != nil {
		t.Fatalf("failed to set language: %v", err)
	}

	jenkinsfile := `
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                echo 'Building...'
                sh 'make build'
                cleanWs()
            }
        }
        stage('Test') {
            steps {
                junit '**/target/*.xml'
                timeout(time: 5, unit: 'MINUTES') {
                    sh './test.sh'
                }
            }
        }
    }
}
`

	tree := parser.Parse([]byte(jenkinsfile), nil)
	defer tree.Close()

	// 1. Find all steps blocks
	stepsBlockQueryStr := `
(closure_call_expression
  function: (identifier) @_kw (#eq? @_kw "steps")
  closure: (closure) @steps_body)
`
	stepsBlockQuery, err := tree_sitter.NewQuery(language, stepsBlockQueryStr)
	if err != nil {
		t.Fatalf("steps block query error: %v", err)
	}
	defer stepsBlockQuery.Close()

	// 2. Step query for commands or method calls
	stepQueryStr := `
[
  (command_expression
    function: (identifier) @step_name
    arguments: (command_argument_list)? @step_args)
  (method_call
    function: (identifier) @step_name
    arguments: (argument_list)? @step_args)
  (closure_call_expression
    function: (identifier) @step_name)
] @step
`
	stepQuery, err := tree_sitter.NewQuery(language, stepQueryStr)
	if err != nil {
		t.Fatalf("step query error: %v", err)
	}
	defer stepQuery.Close()

	qc := tree_sitter.NewQueryCursor()
	defer qc.Close()

	srcBytes := []byte(jenkinsfile)
	blockMatches := qc.Matches(stepsBlockQuery, tree.RootNode(), srcBytes)

	for {
		bm := blockMatches.Next()
		if bm == nil {
			break
		}
		for _, c := range bm.Captures {
			if stepsBlockQuery.CaptureNames()[c.Index] == "steps_body" {
				// Query inside the steps closure!
				innerQC := tree_sitter.NewQueryCursor()
				defer innerQC.Close()
				stepMatches := innerQC.Matches(stepQuery, &c.Node, srcBytes)
				for {
					sm := stepMatches.Next()
					if sm == nil {
						break
					}
					var name, args string
					var startPoint tree_sitter.Point
					for _, sc := range sm.Captures {
						cName := stepQuery.CaptureNames()[sc.Index]
						if cName == "step_name" {
							name = sc.Node.Utf8Text(srcBytes)
							startPoint = sc.Node.StartPosition()
						} else if cName == "step_args" {
							args = sc.Node.Utf8Text(srcBytes)
						}
					}
					t.Logf("Found step: %s (args: %s) at Line %d:%d", name, args, startPoint.Row+1, startPoint.Column+1)
				}
			}
		}
	}
}
