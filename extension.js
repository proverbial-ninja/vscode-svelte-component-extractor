// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */



function activate(context) {

	let disposable = vscode.commands.registerCommand('extension.extract', function () {

		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return; // No open text editor
		}

		var selection = editor.selection;

		//Get 

		var text = editor.document.getText(selection);

		if (!selection) return vscode.window.showErrorMessage("No text Selected");

		let folderPath = path.dirname(vscode.window.activeTextEditor.document.fileName); // get the open folder path

		console.log("Path " + path.dirname(vscode.window.activeTextEditor.document.fileName))

		//Check if folder is in workspace
		if (folderPath == ".") return vscode.window.showErrorMessage("Your file must be in a workspace");


		// Prompt for new component Name
		let options = {
			prompt: "Component Name: ",
			placeHolder: "MyComponent"
		}

		vscode.window.showInputBox(options).then(value => {
			if (!value) return vscode.window.showErrorMessage("No component name, Please try again");

			//convert string to pascal case
			var output = value.replace(/(\w+)(?:\s+|$)/g, function (_, word) {
				return word.charAt(0).toUpperCase() + word.substr(1);
			});


			//Replace selection with new component name
			editor.edit(builder => builder.replace(selection, `<${output}/>`)).then(
				function () {
					var firstLine = editor.document.lineAt(0);
					var lastLine = editor.document.lineAt(editor.document.lineCount - 1);
					var textRange = new vscode.Range(0,
						firstLine.range.start.character,
						editor.document.lineCount - 1,
						lastLine.range.end.character);

					//Add imports by appending to script tag if exixts or prepending it to the file if it doesnt
					var all_text = editor.document.getText(textRange);
					var new_text;

					if (all_text.includes("<script>")) {
						new_text = all_text.replace("<script>",
							`<script>
	import ${output} from "./${output}.svelte"
					`)
					} else {
						new_text =
							`<script>
	import ${output} from "./${output}.svelte"
</script>
`+ all_text;
					}


					editor.edit(builder => builder.replace(textRange, new_text))

				}
			)

			//Save new component with commented out script and style tags
			var filepath = path.join(folderPath, `${output}.svelte`);
			var header = `<!-- <script>
	
</script>
			
<style>
			
</style> -->
`
			fs.writeFile(filepath, header + text, err => {
				if (err) {
					return vscode.window.showErrorMessage(
						"Couldn't create component"
					);
				}
				vscode.window.showInformationMessage("Component Extracted")

				//Open new component
				var openPath = vscode.Uri.parse(filepath);
				vscode.workspace.openTextDocument(openPath).then(doc => {
					vscode.window.showTextDocument(doc);

				});

			});

		});

	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
