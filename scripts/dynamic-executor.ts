#!/usr/bin/env ts-node
/// <reference types="node" />
// @description Dynamic script executor that automatically discovers and runs scripts in the scripts directory

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import inquirer from "inquirer";

// Script types and their executors
const SCRIPT_EXECUTORS = {
  ".ts": (scriptPath: string, args: string[]) => {
    return spawn("npx", ["ts-node", "-r", "tsconfig-paths/register", scriptPath, ...args], {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });
  },
  ".js": (scriptPath: string, args: string[]) => {
    return spawn("node", [scriptPath, ...args], {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });
  },
  ".sh": (scriptPath: string, args: string[]) => {
    return spawn("bash", [scriptPath, ...args], {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });
  },
  ".py": (scriptPath: string, args: string[]) => {
    return spawn("python3", [scriptPath, ...args], {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });
  },
} as const;

type ScriptExtension = keyof typeof SCRIPT_EXECUTORS;

// Discover available scripts
function discoverScripts(): Map<
  string,
  { file: string; type: ScriptExtension; description?: string }
> {
  const scriptsDir = __dirname;
  const scripts = new Map<string, { file: string; type: ScriptExtension; description?: string }>();

  try {
    const files = fs.readdirSync(scriptsDir);

    files.forEach((file) => {
      const ext = path.extname(file) as ScriptExtension;
      const name = path.basename(file, ext);

      // Skip dynamic-executor itself
      if (name === "dynamic-executor") {
        return;
      }

      if (SCRIPT_EXECUTORS[ext]) {
        const filePath = path.join(scriptsDir, file);

        // Try to read description from file comments
        let description: string | undefined;
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split("\n");
          // Look for @description in the first 5 lines
          for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            if (line.includes("@description")) {
              description = line.split("@description")[1]?.trim();
              break;
            }
          }
        } catch (e) {
          // Ignore read errors
        }

        scripts.set(name, { file, type: ext, description });
      }
    });
  } catch (error) {
    console.error(`❌ Error reading scripts directory: ${error}`);
  }

  return scripts;
}

// Show help with discovered scripts
function showHelp(
  scripts: Map<string, { file: string; type: ScriptExtension; description?: string }>,
): void {
  console.log("🚀 AIO Downloader Dynamic Script Executor");
  console.log("");
  console.log("Usage: npm run script <script-name> [options]");
  console.log("   or: npx ts-node scripts/dynamic-executor.ts <script-name> [options]");
  console.log("");
  console.log("Available scripts:");

  const sortedScripts = Array.from(scripts.entries()).sort(([a], [b]) => a.localeCompare(b));

  sortedScripts.forEach(([name, { file, type, description }]) => {
    const nameCol = name.padEnd(20);
    const fileCol = file.padEnd(25);
    const typeCol = type.padEnd(8);
    const descCol = description || "No description";

    console.log(`  ${nameCol} → ${fileCol} [${typeCol}] ${descCol}`);
  });

  console.log("");
  console.log("Examples:");
  console.log("  npm run script create-admin-users");
  console.log("  npm run script cronjob");
  console.log("  npm run script help");
  console.log("");
  console.log("You can also run scripts directly:");
  console.log("  npm run script create-admin-users");
  console.log("  npx ts-node -r tsconfig-paths/register scripts/create-admin-users.ts");
  console.log("");
  console.log("Script Discovery:");
  console.log(
    "  This executor automatically discovers all executable scripts in the scripts/ directory",
  );
  console.log("  Supported file types: .ts, .js, .sh, .py");
}

// Execute script function
async function executeScript(
  scriptName: string,
  args: string[] = [],
  scripts: Map<string, { file: string; type: ScriptExtension; description?: string }>,
): Promise<void> {
  if (scriptName === "help") {
    showHelp(scripts);
    return;
  }

  const scriptInfo = scripts.get(scriptName);

  if (!scriptInfo) {
    console.error(`❌ Unknown script: ${scriptName}`);
    console.log("");
    showHelp(scripts);
    process.exit(1);
  }

  const { file, type } = scriptInfo;
  const scriptPath = path.join(__dirname, file);

  // Check if script file exists
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Script file not found: ${scriptPath}`);
    process.exit(1);
  }

  console.log(`🚀 Executing script: ${scriptName} → ${file}`);
  console.log(`📁 Script path: ${scriptPath}`);
  console.log(`🔧 Type: ${type}`);
  console.log(`🔧 Arguments: ${args.length > 0 ? args.join(" ") : "none"}`);
  console.log("");

  // Execute the script
  const executor = SCRIPT_EXECUTORS[type];
  if (!executor) {
    console.error(`❌ Unsupported script type: ${type}`);
    process.exit(1);
  }

  const child = executor(scriptPath, args);

  child.on("error", (error) => {
    console.error(`❌ Failed to execute script: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`❌ Script execution failed with code: ${code}`);
      process.exit(code || 1);
    }
    console.log("✅ Script executed successfully");
  });
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const scripts = discoverScripts();

  if (args.length === 0) {
    // Interactive mode: list scripts and prompt user with arrow-key selection
    const scriptList = Array.from(scripts.entries());
    if (scriptList.length === 0) {
      console.log("No scripts found in the scripts directory.");
      process.exit(1);
    }

    const choices = [
      ...scriptList.map(([name, { description }], idx) => ({
        name: `[${idx + 1}] ${name} - ${description || "No description"}`,
        value: name,
      })),
      { name: "❌ Cancel", value: "__cancel__" },
    ];

    const { scriptName } = await inquirer.prompt([
      {
        type: "list",
        name: "scriptName",
        message: "Select a script to run:",
        choices,
      },
    ]);

    if (scriptName === "__cancel__") {
      console.log("Operation cancelled.");
      process.exit(0);
    }

    await executeScript(scriptName, [], scripts);
    return;
  }

  const scriptName = args[0];
  const scriptArgs = args.slice(1);

  try {
    await executeScript(scriptName, scriptArgs, scripts);
  } catch (error) {
    console.error(`❌ Error executing script: ${error}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { executeScript, showHelp, discoverScripts, SCRIPT_EXECUTORS };
