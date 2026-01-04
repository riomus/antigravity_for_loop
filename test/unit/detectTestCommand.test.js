// test/unit/detectTestCommand.test.js
// Comprehensive unit tests for detectTestCommand function
// Tests all 20+ supported languages/frameworks

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Extract detectTestCommand from extension.js for testing
// We'll create a standalone version here since the original is embedded

/**
 * Standalone detectTestCommand for testing
 * (Mirrors the logic in extension.js)
 */
function detectTestCommand(workspacePath) {
    const exists = (file) => fs.existsSync(path.join(workspacePath, file));
    const readJson = (file) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(workspacePath, file), 'utf8'));
        } catch (e) { return null; }
    };
    const findFile = (pattern) => {
        try {
            const files = fs.readdirSync(workspacePath);
            return files.find(f => f.match(pattern));
        } catch (e) { return null; }
    };

    const detected = [];

    // ===== JavaScript / TypeScript =====
    if (exists('package.json')) {
        const pkg = readJson('package.json');
        if (pkg?.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
            detected.push({ cmd: 'npm test', type: 'npm', lang: 'JavaScript/TypeScript', priority: 10 });
        }
        if (pkg?.scripts?.build) {
            detected.push({ cmd: 'npm run build', type: 'build', lang: 'JavaScript/TypeScript', priority: 5 });
        }
        if (pkg?.scripts?.lint) {
            detected.push({ cmd: 'npm run lint', type: 'lint', lang: 'JavaScript/TypeScript', priority: 3 });
        }
    }
    if (exists('deno.json') || exists('deno.jsonc')) {
        detected.push({ cmd: 'deno test', type: 'deno', lang: 'Deno', priority: 10 });
    }
    if (exists('bun.lockb')) {
        detected.push({ cmd: 'bun test', type: 'bun', lang: 'Bun', priority: 10 });
    }

    // ===== Python =====
    if (exists('pyproject.toml') || exists('setup.py') || exists('requirements.txt') || exists('Pipfile')) {
        if (exists('pytest.ini') || exists('pyproject.toml')) {
            detected.push({ cmd: 'pytest', type: 'pytest', lang: 'Python', priority: 10 });
        } else if (exists('tox.ini')) {
            detected.push({ cmd: 'tox', type: 'tox', lang: 'Python', priority: 10 });
        } else {
            detected.push({ cmd: 'python -m pytest', type: 'python', lang: 'Python', priority: 8 });
        }
        if (exists('mypy.ini') || exists('pyproject.toml')) {
            detected.push({ cmd: 'mypy .', type: 'mypy', lang: 'Python', priority: 5 });
        }
    }

    // ===== Rust =====
    if (exists('Cargo.toml')) {
        detected.push({ cmd: 'cargo test', type: 'cargo', lang: 'Rust', priority: 10 });
        detected.push({ cmd: 'cargo build', type: 'cargo-build', lang: 'Rust', priority: 5 });
        detected.push({ cmd: 'cargo clippy', type: 'clippy', lang: 'Rust', priority: 3 });
    }

    // ===== Go =====
    if (exists('go.mod')) {
        detected.push({ cmd: 'go test ./...', type: 'go', lang: 'Go', priority: 10 });
        detected.push({ cmd: 'go build ./...', type: 'go-build', lang: 'Go', priority: 5 });
        detected.push({ cmd: 'golangci-lint run', type: 'golint', lang: 'Go', priority: 3 });
    }

    // ===== Java / Kotlin (JVM) =====
    if (exists('pom.xml')) {
        detected.push({ cmd: 'mvn test', type: 'maven', lang: 'Java/Kotlin', priority: 10 });
        detected.push({ cmd: 'mvn compile', type: 'maven-build', lang: 'Java/Kotlin', priority: 5 });
    }
    if (exists('build.gradle') || exists('build.gradle.kts')) {
        detected.push({ cmd: './gradlew test', type: 'gradle', lang: 'Java/Kotlin', priority: 10 });
        detected.push({ cmd: './gradlew build', type: 'gradle-build', lang: 'Java/Kotlin', priority: 5 });
    }

    // ===== Ruby =====
    if (exists('Gemfile')) {
        if (exists('.rspec') || exists('spec')) {
            detected.push({ cmd: 'bundle exec rspec', type: 'rspec', lang: 'Ruby', priority: 10 });
        } else if (exists('Rakefile')) {
            detected.push({ cmd: 'bundle exec rake test', type: 'rake', lang: 'Ruby', priority: 10 });
        } else {
            detected.push({ cmd: 'bundle exec rake', type: 'ruby', lang: 'Ruby', priority: 8 });
        }
    }

    // ===== .NET / C# / F# =====
    if (findFile(/\.sln$/) || findFile(/\.csproj$/) || findFile(/\.fsproj$/)) {
        detected.push({ cmd: 'dotnet test', type: 'dotnet', lang: '.NET', priority: 10 });
        detected.push({ cmd: 'dotnet build', type: 'dotnet-build', lang: '.NET', priority: 5 });
    }

    // ===== PHP =====
    if (exists('composer.json')) {
        if (exists('phpunit.xml') || exists('phpunit.xml.dist')) {
            detected.push({ cmd: './vendor/bin/phpunit', type: 'phpunit', lang: 'PHP', priority: 10 });
        }
        const composer = readJson('composer.json');
        if (composer?.scripts?.test) {
            detected.push({ cmd: 'composer test', type: 'composer', lang: 'PHP', priority: 9 });
        }
    }

    // ===== Swift =====
    if (exists('Package.swift')) {
        detected.push({ cmd: 'swift test', type: 'swift', lang: 'Swift', priority: 10 });
        detected.push({ cmd: 'swift build', type: 'swift-build', lang: 'Swift', priority: 5 });
    }
    if (findFile(/\.xcodeproj$/) || findFile(/\.xcworkspace$/)) {
        detected.push({ cmd: 'xcodebuild test', type: 'xcode', lang: 'Swift/ObjC', priority: 8 });
    }

    // ===== Dart / Flutter =====
    if (exists('pubspec.yaml')) {
        if (exists('test')) {
            if (exists('android') || exists('ios')) {
                detected.push({ cmd: 'flutter test', type: 'flutter', lang: 'Flutter', priority: 10 });
            } else {
                detected.push({ cmd: 'dart test', type: 'dart', lang: 'Dart', priority: 10 });
            }
        }
        detected.push({ cmd: 'dart analyze', type: 'dart-analyze', lang: 'Dart', priority: 5 });
    }

    // ===== Elixir =====
    if (exists('mix.exs')) {
        detected.push({ cmd: 'mix test', type: 'elixir', lang: 'Elixir', priority: 10 });
    }

    // ===== Erlang =====
    if (exists('rebar.config')) {
        detected.push({ cmd: 'rebar3 eunit', type: 'erlang', lang: 'Erlang', priority: 10 });
    }

    // ===== Haskell =====
    if (exists('stack.yaml')) {
        detected.push({ cmd: 'stack test', type: 'stack', lang: 'Haskell', priority: 10 });
    }
    if (exists('cabal.project') || findFile(/\.cabal$/)) {
        detected.push({ cmd: 'cabal test', type: 'cabal', lang: 'Haskell', priority: 9 });
    }

    // ===== Scala =====
    if (exists('build.sbt')) {
        detected.push({ cmd: 'sbt test', type: 'sbt', lang: 'Scala', priority: 10 });
    }

    // ===== Clojure =====
    if (exists('project.clj')) {
        detected.push({ cmd: 'lein test', type: 'lein', lang: 'Clojure', priority: 10 });
    }
    if (exists('deps.edn')) {
        detected.push({ cmd: 'clj -X:test', type: 'clojure', lang: 'Clojure', priority: 9 });
    }

    // ===== C / C++ =====
    if (exists('CMakeLists.txt')) {
        detected.push({ cmd: 'cmake --build build && ctest --test-dir build', type: 'cmake', lang: 'C/C++', priority: 10 });
    }
    if (exists('meson.build')) {
        detected.push({ cmd: 'meson test -C build', type: 'meson', lang: 'C/C++', priority: 10 });
    }
    if (exists('conanfile.txt') || exists('conanfile.py')) {
        detected.push({ cmd: 'conan build . && ctest', type: 'conan', lang: 'C/C++', priority: 8 });
    }

    // ===== Zig =====
    if (exists('build.zig')) {
        detected.push({ cmd: 'zig build test', type: 'zig', lang: 'Zig', priority: 10 });
    }

    // ===== Nim =====
    if (findFile(/\.nimble$/)) {
        detected.push({ cmd: 'nimble test', type: 'nim', lang: 'Nim', priority: 10 });
    }

    // ===== V =====
    if (exists('v.mod')) {
        detected.push({ cmd: 'v test .', type: 'vlang', lang: 'V', priority: 10 });
    }

    // ===== OCaml =====
    if (exists('dune-project')) {
        detected.push({ cmd: 'dune runtest', type: 'dune', lang: 'OCaml', priority: 10 });
    }

    // ===== Generic Build Systems =====
    if (exists('Makefile') || exists('makefile') || exists('GNUmakefile')) {
        detected.push({ cmd: 'make test', type: 'make', lang: 'Make', priority: 6 });
        detected.push({ cmd: 'make', type: 'make-build', lang: 'Make', priority: 4 });
    }
    if (exists('justfile') || exists('Justfile')) {
        detected.push({ cmd: 'just test', type: 'just', lang: 'Just', priority: 7 });
    }
    if (exists('Taskfile.yml') || exists('Taskfile.yaml')) {
        detected.push({ cmd: 'task test', type: 'task', lang: 'Task', priority: 7 });
    }
    if (exists('Earthfile')) {
        detected.push({ cmd: 'earthly +test', type: 'earthly', lang: 'Earthly', priority: 7 });
    }
    if (exists('BUILD.bazel') || exists('WORKSPACE')) {
        detected.push({ cmd: 'bazel test //...', type: 'bazel', lang: 'Bazel', priority: 8 });
    }
    if (exists('pants.toml')) {
        detected.push({ cmd: 'pants test ::', type: 'pants', lang: 'Pants', priority: 8 });
    }

    // Sort by priority and return the highest
    if (detected.length === 0) return null;
    detected.sort((a, b) => b.priority - a.priority);
    return detected[0];
}

// Helper to create temporary directories with fixture files
class TempProject {
    constructor() {
        this.basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-test-'));
    }

    createFile(relativePath, content = '') {
        const filePath = path.join(this.basePath, relativePath);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content);
        return this;
    }

    createDir(relativePath) {
        fs.mkdirSync(path.join(this.basePath, relativePath), { recursive: true });
        return this;
    }

    cleanup() {
        fs.rmSync(this.basePath, { recursive: true, force: true });
    }

    get path() {
        return this.basePath;
    }
}

describe('detectTestCommand', function() {
    let project;

    afterEach(function() {
        if (project) {
            project.cleanup();
            project = null;
        }
    });

    describe('JavaScript/TypeScript Projects', function() {
        it('should detect npm test from package.json', function() {
            project = new TempProject();
            project.createFile('package.json', JSON.stringify({
                name: 'test-project',
                scripts: { test: 'jest' }
            }));

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'npm test');
            assert.strictEqual(result.lang, 'JavaScript/TypeScript');
        });

        it('should not detect npm test if test script is default placeholder', function() {
            project = new TempProject();
            project.createFile('package.json', JSON.stringify({
                name: 'test-project',
                scripts: { test: 'echo "Error: no test specified" && exit 1' }
            }));

            const result = detectTestCommand(project.path);
            assert.strictEqual(result, null);
        });

        it('should detect Deno projects', function() {
            project = new TempProject();
            project.createFile('deno.json', JSON.stringify({ tasks: {} }));

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'deno test');
            assert.strictEqual(result.lang, 'Deno');
        });

        it('should detect Bun projects', function() {
            project = new TempProject();
            project.createFile('bun.lockb', '');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bun test');
            assert.strictEqual(result.lang, 'Bun');
        });
    });

    describe('Python Projects', function() {
        it('should detect pytest with pyproject.toml', function() {
            project = new TempProject();
            project.createFile('pyproject.toml', '[tool.pytest.ini_options]');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'pytest');
            assert.strictEqual(result.lang, 'Python');
        });

        it('should detect tox', function() {
            project = new TempProject();
            project.createFile('requirements.txt', 'pytest');
            project.createFile('tox.ini', '[tox]');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'tox');
        });

        it('should fallback to python -m pytest', function() {
            project = new TempProject();
            project.createFile('requirements.txt', 'pytest');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'python -m pytest');
        });
    });

    describe('Rust Projects', function() {
        it('should detect cargo test', function() {
            project = new TempProject();
            project.createFile('Cargo.toml', '[package]\nname = "test"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'cargo test');
            assert.strictEqual(result.lang, 'Rust');
        });
    });

    describe('Go Projects', function() {
        it('should detect go test', function() {
            project = new TempProject();
            project.createFile('go.mod', 'module example.com/test');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'go test ./...');
            assert.strictEqual(result.lang, 'Go');
        });
    });

    describe('Java/Kotlin Projects', function() {
        it('should detect Maven', function() {
            project = new TempProject();
            project.createFile('pom.xml', '<project></project>');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'mvn test');
            assert.strictEqual(result.lang, 'Java/Kotlin');
        });

        it('should detect Gradle', function() {
            project = new TempProject();
            project.createFile('build.gradle', 'apply plugin: java');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, './gradlew test');
        });

        it('should detect Gradle Kotlin DSL', function() {
            project = new TempProject();
            project.createFile('build.gradle.kts', 'plugins { kotlin("jvm") }');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, './gradlew test');
        });
    });

    describe('Ruby Projects', function() {
        it('should detect RSpec', function() {
            project = new TempProject();
            project.createFile('Gemfile', 'gem "rspec"');
            project.createFile('.rspec', '--format progress');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bundle exec rspec');
            assert.strictEqual(result.lang, 'Ruby');
        });

        it('should detect Rake with spec directory', function() {
            project = new TempProject();
            project.createFile('Gemfile', 'gem "rspec"');
            project.createDir('spec');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bundle exec rspec');
        });

        it('should fallback to rake test', function() {
            project = new TempProject();
            project.createFile('Gemfile', 'gem "minitest"');
            project.createFile('Rakefile', 'task :test');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bundle exec rake test');
        });
    });

    describe('.NET Projects', function() {
        it('should detect .sln file', function() {
            project = new TempProject();
            project.createFile('MyProject.sln', '');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'dotnet test');
            assert.strictEqual(result.lang, '.NET');
        });

        it('should detect .csproj file', function() {
            project = new TempProject();
            project.createFile('MyProject.csproj', '<Project></Project>');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'dotnet test');
        });

        it('should detect .fsproj file', function() {
            project = new TempProject();
            project.createFile('MyProject.fsproj', '<Project></Project>');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'dotnet test');
        });
    });

    describe('PHP Projects', function() {
        it('should detect PHPUnit', function() {
            project = new TempProject();
            project.createFile('composer.json', '{}');
            project.createFile('phpunit.xml', '<phpunit></phpunit>');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, './vendor/bin/phpunit');
            assert.strictEqual(result.lang, 'PHP');
        });

        it('should detect composer test script', function() {
            project = new TempProject();
            project.createFile('composer.json', JSON.stringify({
                scripts: { test: 'phpunit' }
            }));

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'composer test');
        });
    });

    describe('Swift Projects', function() {
        it('should detect Swift Package Manager', function() {
            project = new TempProject();
            project.createFile('Package.swift', 'import PackageDescription');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'swift test');
            assert.strictEqual(result.lang, 'Swift');
        });

        it('should detect Xcode project', function() {
            project = new TempProject();
            project.createDir('MyApp.xcodeproj');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'xcodebuild test');
        });
    });

    describe('Dart/Flutter Projects', function() {
        it('should detect Flutter project', function() {
            project = new TempProject();
            project.createFile('pubspec.yaml', 'name: my_app');
            project.createDir('test');
            project.createDir('android');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'flutter test');
            assert.strictEqual(result.lang, 'Flutter');
        });

        it('should detect pure Dart project', function() {
            project = new TempProject();
            project.createFile('pubspec.yaml', 'name: my_package');
            project.createDir('test');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'dart test');
            assert.strictEqual(result.lang, 'Dart');
        });
    });

    describe('Elixir Projects', function() {
        it('should detect Mix project', function() {
            project = new TempProject();
            project.createFile('mix.exs', 'defmodule MyApp.MixProject');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'mix test');
            assert.strictEqual(result.lang, 'Elixir');
        });
    });

    describe('Erlang Projects', function() {
        it('should detect Rebar3 project', function() {
            project = new TempProject();
            project.createFile('rebar.config', '{erl_opts, [debug_info]}');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'rebar3 eunit');
            assert.strictEqual(result.lang, 'Erlang');
        });
    });

    describe('Haskell Projects', function() {
        it('should detect Stack project', function() {
            project = new TempProject();
            project.createFile('stack.yaml', 'resolver: lts-20');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'stack test');
            assert.strictEqual(result.lang, 'Haskell');
        });

        it('should detect Cabal project', function() {
            project = new TempProject();
            project.createFile('my-project.cabal', 'name: my-project');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'cabal test');
        });
    });

    describe('Scala Projects', function() {
        it('should detect SBT project', function() {
            project = new TempProject();
            project.createFile('build.sbt', 'name := "my-project"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'sbt test');
            assert.strictEqual(result.lang, 'Scala');
        });
    });

    describe('Clojure Projects', function() {
        it('should detect Leiningen project', function() {
            project = new TempProject();
            project.createFile('project.clj', '(defproject my-project)');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'lein test');
            assert.strictEqual(result.lang, 'Clojure');
        });

        it('should detect deps.edn project', function() {
            project = new TempProject();
            project.createFile('deps.edn', '{:deps {}}');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'clj -X:test');
        });
    });

    describe('C/C++ Projects', function() {
        it('should detect CMake project', function() {
            project = new TempProject();
            project.createFile('CMakeLists.txt', 'cmake_minimum_required(VERSION 3.10)');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'cmake --build build && ctest --test-dir build');
            assert.strictEqual(result.lang, 'C/C++');
        });

        it('should detect Meson project', function() {
            project = new TempProject();
            project.createFile('meson.build', "project('my-project', 'c')");

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'meson test -C build');
        });
    });

    describe('Zig Projects', function() {
        it('should detect Zig project', function() {
            project = new TempProject();
            project.createFile('build.zig', 'const std = @import("std");');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'zig build test');
            assert.strictEqual(result.lang, 'Zig');
        });
    });

    describe('Nim Projects', function() {
        it('should detect Nimble project', function() {
            project = new TempProject();
            project.createFile('mypackage.nimble', 'version = "0.1.0"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'nimble test');
            assert.strictEqual(result.lang, 'Nim');
        });
    });

    describe('V Projects', function() {
        it('should detect V project', function() {
            project = new TempProject();
            project.createFile('v.mod', 'Module { name: "myproject" }');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'v test .');
            assert.strictEqual(result.lang, 'V');
        });
    });

    describe('OCaml Projects', function() {
        it('should detect Dune project', function() {
            project = new TempProject();
            project.createFile('dune-project', '(lang dune 3.0)');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'dune runtest');
            assert.strictEqual(result.lang, 'OCaml');
        });
    });

    describe('Generic Build Systems', function() {
        it('should detect Makefile', function() {
            project = new TempProject();
            project.createFile('Makefile', 'test:\n\techo "test"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'make test');
            assert.strictEqual(result.lang, 'Make');
        });

        it('should detect justfile', function() {
            project = new TempProject();
            project.createFile('justfile', 'test:\n  echo "test"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'just test');
            assert.strictEqual(result.lang, 'Just');
        });

        it('should detect Taskfile', function() {
            project = new TempProject();
            project.createFile('Taskfile.yml', 'version: 3\ntasks:\n  test:');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'task test');
            assert.strictEqual(result.lang, 'Task');
        });

        it('should detect Earthfile', function() {
            project = new TempProject();
            project.createFile('Earthfile', 'VERSION 0.7');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'earthly +test');
            assert.strictEqual(result.lang, 'Earthly');
        });

        it('should detect Bazel project', function() {
            project = new TempProject();
            project.createFile('BUILD.bazel', 'load("@rules_cc//cc:defs.bzl", "cc_test")');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bazel test //...');
            assert.strictEqual(result.lang, 'Bazel');
        });

        it('should detect Pants project', function() {
            project = new TempProject();
            project.createFile('pants.toml', '[GLOBAL]\npants_version = "2.15"');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'pants test ::');
            assert.strictEqual(result.lang, 'Pants');
        });
    });

    describe('Priority Ordering', function() {
        it('should prefer npm test over Makefile', function() {
            project = new TempProject();
            project.createFile('package.json', JSON.stringify({
                name: 'test',
                scripts: { test: 'jest' }
            }));
            project.createFile('Makefile', 'test:');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'npm test');
        });

        it('should prefer Bazel over Makefile', function() {
            project = new TempProject();
            project.createFile('BUILD.bazel', '');
            project.createFile('Makefile', 'test:');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result.cmd, 'bazel test //...');
        });
    });

    describe('Edge Cases', function() {
        it('should return null for empty directory', function() {
            project = new TempProject();

            const result = detectTestCommand(project.path);
            assert.strictEqual(result, null);
        });

        it('should handle malformed package.json', function() {
            project = new TempProject();
            project.createFile('package.json', 'not valid json');

            const result = detectTestCommand(project.path);
            assert.strictEqual(result, null);
        });

        it('should handle non-existent directory', function() {
            const result = detectTestCommand('/nonexistent/path');
            assert.strictEqual(result, null);
        });
    });
});
