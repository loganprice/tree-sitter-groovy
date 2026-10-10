package main

import (
	"os"
	"testing"
)

func TestAnalyzeDeclarativeKubernetesPipeline(t *testing.T) {
	content, err := os.ReadFile("Jenkinsfile.declarative")
	if err != nil {
		t.Fatalf("failed to read Jenkinsfile.declarative: %v", err)
	}

	report, err := AnalyzeJenkinsfile("Jenkinsfile.declarative", content)
	if err != nil {
		t.Fatalf("AnalyzeJenkinsfile failed: %v", err)
	}

	if report.PipelineType != "Declarative (Kubernetes)" {
		t.Errorf("expected pipeline type 'Declarative (Kubernetes)', got %q", report.PipelineType)
	}

	expectedContainers := []string{"kaniko", "maven"}
	if len(report.Containers) != len(expectedContainers) {
		t.Fatalf("expected %d containers, got %d", len(expectedContainers), len(report.Containers))
	}
	for i, c := range expectedContainers {
		if report.Containers[i] != c {
			t.Errorf("[%d] expected container %q, got %q", i, c, report.Containers[i])
		}
	}

	// Verify container assignment on key steps
	stepFound := false
	for _, s := range report.Steps {
		if s.Name == "sh" && s.Stage == "Build & Test" {
			stepFound = true
			if s.Container != "maven" {
				t.Errorf("expected maven container for mvn verify, got %q", s.Container)
			}
		}
		if s.Name == "sh" && s.Stage == "Build Container Image" {
			if s.Container != "kaniko" {
				t.Errorf("expected kaniko container for kaniko build, got %q", s.Container)
			}
		}
		if s.Stage == "Checkout" && s.Container != "" {
			t.Errorf("expected empty container (jnlp/default) for checkout, got %q", s.Container)
		}
	}
	if !stepFound {
		t.Errorf("did not find expected sh step in 'Build & Test'")
	}
}

func TestAnalyzeScriptedKubernetesPipeline(t *testing.T) {
	content, err := os.ReadFile("Jenkinsfile.scripted")
	if err != nil {
		t.Fatalf("failed to read Jenkinsfile.scripted: %v", err)
	}

	report, err := AnalyzeJenkinsfile("Jenkinsfile.scripted", content)
	if err != nil {
		t.Fatalf("AnalyzeJenkinsfile failed: %v", err)
	}

	if report.PipelineType != "Scripted (Kubernetes)" {
		t.Errorf("expected pipeline type 'Scripted (Kubernetes)', got %q", report.PipelineType)
	}
	if report.PodName != "go-build-pod" {
		t.Errorf("expected pod name 'go-build-pod', got %q", report.PodName)
	}
	if report.PodLabel != "go-build-agent" {
		t.Errorf("expected pod label 'go-build-agent', got %q", report.PodLabel)
	}

	expectedContainers := []string{"golang", "helm"}
	if len(report.Containers) != len(expectedContainers) {
		t.Fatalf("expected %d containers, got %d", len(expectedContainers), len(report.Containers))
	}

	for _, s := range report.Steps {
		if s.Stage == "Test & Build" && s.Name == "sh" {
			if s.Container != "golang" {
				t.Errorf("expected golang container for Test & Build, got %q", s.Container)
			}
		}
		if s.Stage == "Package & Deploy" && s.Name == "sh" {
			if s.Container != "helm" {
				t.Errorf("expected helm container for Package & Deploy, got %q", s.Container)
			}
		}
	}
}

func TestAnalyzeDeclarativePipeline(t *testing.T) {
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
    post {
        always {
            cleanWs()
        }
    }
}
`
	report, err := AnalyzeJenkinsfile("inline", []byte(jenkinsfile))
	if err != nil {
		t.Fatalf("AnalyzeJenkinsfile failed: %v", err)
	}

	if report.PipelineType != "Declarative" {
		t.Errorf("expected pipeline type 'Declarative', got %q", report.PipelineType)
	}

	expected := []struct {
		Stage   string
		Name    string
		IsBlock bool
	}{
		{"Build", "echo", false},
		{"Build", "sh", false},
		{"Build", "cleanWs", false},
		{"Test", "junit", false},
		{"Test", "timeout", true},
		{"Test", "sh", false},
		{"post: always", "cleanWs", false},
	}

	if len(report.Steps) != len(expected) {
		t.Fatalf("expected %d steps, got %d", len(expected), len(report.Steps))
	}

	for i, exp := range expected {
		if report.Steps[i].Stage != exp.Stage {
			t.Errorf("[%d] expected stage %q, got %q", i, exp.Stage, report.Steps[i].Stage)
		}
		if report.Steps[i].Name != exp.Name {
			t.Errorf("[%d] expected step name %q, got %q", i, exp.Name, report.Steps[i].Name)
		}
		if report.Steps[i].IsBlock != exp.IsBlock {
			t.Errorf("[%d] expected isBlock %v, got %v", i, exp.IsBlock, report.Steps[i].IsBlock)
		}
	}
}
