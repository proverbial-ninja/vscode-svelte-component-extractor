"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const fse = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function activate(context) {
    let disposable = vscode.commands.registerCommand("extension.extract", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !vscode.window.activeTextEditor) {
            return; // No open text editor
        }
        let selection = editor.selection;
        if (!selection) {
            return vscode.window.showErrorMessage("No text selected");
        }
        let body = editor.document.getText(selection);
        const variablesWithShortnames = inferVariablesInText(body);
        let folder_path = path.dirname(vscode.window.activeTextEditor.document.fileName);
        console.log("Path " + path.dirname(vscode.window.activeTextEditor.document.fileName));
        //Check if folder is in workspace
        if (folder_path === ".") {
            return vscode.window.showErrorMessage("Your file must be in a workspace");
        }
        // Prompt for new component Name
        let options = {
            prompt: "Component Name: ",
            placeHolder: "MyComponent",
        };
        let entered_name = await vscode.window.showInputBox(options);
        if (!entered_name) {
            return vscode.window.showErrorMessage("No component name, please try again");
        }
        if (entered_name.endsWith(".svelte")) {
            entered_name = entered_name.replace(".svelte", "");
        }
        let component_name = afterLast(entered_name, "/");
        let component_path = "";
        if (entered_name.includes("/")) {
            component_path = entered_name.substring(0, entered_name.lastIndexOf("/"));
        }
        component_name = toPascalCase(component_name);
        // The usual script tag is our default for the new component
        // In case the current file uses something different (e.g. '<script lang="ts">), we will use this in the new component, too
        let scriptStartTag = "<script>";
        //Replace selection with new component name
        await editor.edit((builder) => builder.replace(selection, `<${component_name} ${variablesWithShortnames
            .map((variableAndShortName) => `${variableAndShortName.propName}={${variableAndShortName.fullExpression}}`)
            .join(" ")} />`));
        let firstLine = editor.document.lineAt(0);
        let lastLine = editor.document.lineAt(editor.document.lineCount - 1);
        let textRange = new vscode.Range(0, firstLine.range.start.character, editor.document.lineCount - 1, lastLine.range.end.character);
        // Add imports by appending to script tag if exixts or prepending it to the file if it doesnt
        let selected_text = editor.document.getText(textRange);
        let new_text_for_existing_file;
        const scriptStartMatcher = selected_text.match(/<script.*?>/);
        const importStatement = `\n\timport ${component_name} from "./${component_path}/${component_name}.svelte"\n`;
        if (scriptStartMatcher) {
            scriptStartTag = scriptStartMatcher[0];
            new_text_for_existing_file = selected_text.replace(scriptStartTag, `${scriptStartTag}${importStatement}`);
        }
        else {
            new_text_for_existing_file =
                `<script>${importStatement}</script>
  ` + selected_text;
        }
        await editor.edit((builder) => builder.replace(textRange, new_text_for_existing_file));
        // Save new component with commented out script and style tags
        let filepath = path.join(folder_path, component_path, `${component_name}.svelte`);
        let header = `${scriptStartTag}
${variablesWithShortnames
            .map((variableAndShortName) => "\texport let " + variableAndShortName.propName + ";")
            .join("\n")}
</script>

`;
        for (const variableAndShortName of variablesWithShortnames) {
            body = body.replace(new RegExp(escapeRegExp("{" + variableAndShortName.fullExpression + "}"), "g"), "{" + variableAndShortName.propName + "}");
        }
        fse.outputFile(filepath, header + body, async (err) => {
            if (err) {
                return vscode.window.showErrorMessage("Couldn't create component");
            }
            else {
                vscode.window.showInformationMessage("Component extracted");
                const doc = await vscode.workspace.openTextDocument(filepath);
                await vscode.window.showTextDocument(doc);
                await formatDocument(doc);
            }
        });
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
/**
 * Heuristically tries to infer variables in the given snippet.
 * Example: '<div>{foo.bar}</div>' will lead to the following result:
 * [{propName: 'bar', fullExpression: 'foo.bar'}]
 *
 * For now, only detects simple cases, no arbitrary JS expressions
 */
function inferVariablesInText(text) {
    const result = [];
    const matches = text.matchAll(/{(?:\@html\s+)?([\.\w\d_]+)}/g);
    for (const match of matches) {
        result.push({
            fullExpression: match[1],
            propName: afterLast(match[1], "."),
        });
    }
    return result;
}
function toPascalCase(input) {
    return input.replace(/(\w+)(?:\s+|$)/g, function (_, word) {
        return word.charAt(0).toUpperCase() + word.substr(1);
    });
}
function afterLast(input, separator) {
    const lastIndex = input.lastIndexOf(separator);
    if (lastIndex == -1) {
        return input;
    }
    return input.substr(lastIndex + separator.length);
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
async function formatDocument(document) {
    try {
        await vscode.commands.executeCommand("editor.action.formatDocument", document.uri);
    }
    catch (error) {
        console.error("Error while formatting the document:", error);
    }
}
//# sourceMappingURL=extension.js.map