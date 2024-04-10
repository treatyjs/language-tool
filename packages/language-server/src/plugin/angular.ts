import ts from 'typescript';
import { CompletionItem, CompletionItemKind, FileChangeType, ServicePlugin, ServicePluginInstance, URI } from '@volar/language-server';
import { Provide } from 'volar-service-typescript';
import path from 'path';

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}


export const angularService: (ts: typeof import('typescript')) => ServicePlugin  =  (ts: typeof import('typescript')) => ({
	name: 'angular-service',
	create(context): ServicePluginInstance {
		let lastProjectVersion: string | undefined;

		const { fs, onDidChangeWatchedFiles, workspaceFolder } = context.env;
		assert(fs, 'context.env.fs must be defined');
		assert(
			onDidChangeWatchedFiles,
			'context.env.fs.onDidChangeWatchedFiles must be defined'
		);

		console.log(fs.readDirectory(workspaceFolder));



		// const { languageServiceHost } = context.language.typescript!;

		// for (const fileName of languageServiceHost.getScriptFileNames()) {
		// 	console.log(fileName);
		// 	const uri = context.env.typescript!.fileNameToUri(fileName);
		// 	const [_, sourceFile] = context.documents.getVirtualCodeByUri(uri);
		// 	console.log(sourceFile)
		// 	debugger;
		// }


		// const fileWatcher = onDidChangeWatchedFiles(event => {
		// 	for (const change of event.changes) {
		// 		switch (change.type) {
		// 			case 2 satisfies typeof FileChangeType.Changed: {
		// 				const document = getTextDocument(change.uri, false);
		// 				if (document) {
		// 					// onDidChangeMarkdownDocument.fire(document);
		// 				}
		// 				break;
		// 			}
		// 			case 1 satisfies typeof FileChangeType.Created: {
		// 				const document = getTextDocument(change.uri, false);
		// 				if (document) {
		// 					// onDidCreateMarkdownDocument.fire(document);
		// 				}
		// 				break;
		// 			}
		// 			case 3 satisfies typeof FileChangeType.Deleted: {
		// 				// onDidDeleteMarkdownDocument.fire(URI.parse(change.uri));
		// 				break;
		// 			}
		// 		}
		// 	}
		// });

		// function getTextDocument(uri: string, includeVirtualFile: boolean) {
		// 	if (includeVirtualFile) {
		// 		const virtualCode = context.documents.getVirtualCodeByUri(uri)[0];
		// 		if (virtualCode) {
		// 			return context.documents.get(uri, virtualCode.languageId, virtualCode.snapshot);
		// 		}
		// 	}
		// 	const sourceFile = context.language.files.get(uri);
		// 	if (sourceFile) {
		// 		return context.documents.get(uri, sourceFile.languageId, sourceFile.snapshot);
		// 	}
		// }

		return {
			provideCompletionItems(document, position, token) {
				const languageService = context.inject<Provide, 'typescript/languageService'>(
					'typescript/languageService'
				);
				if (!languageService) return;



				const tsProgram = languageService.getProgram();


				const tsFileName = getComponentClassFromTemplateDocument(document.uri, languageService, tsProgram!);
				if (!tsFileName) {
					return;
				}

				const sourceFile = tsProgram?.getSourceFile(tsFileName);
				if (!sourceFile) {
					return;
				}

				const completions: CompletionItem[] = [];
				ts.forEachChild(sourceFile, (node) => {
					if (ts.isClassDeclaration(node)) {
						node.members.forEach((member) => {
							if (ts.isPropertyDeclaration(member) && member.name) {
								completions.push({
									label: member.name.getText(),
									kind: CompletionItemKind.Variable,
									data: { fileName: tsFileName, position: member.pos },
								});
							} else if (ts.isMethodDeclaration(member) && member.name) {
								completions.push({
									label: member.name.getText(),
									kind: CompletionItemKind.Method,
									data: { fileName: tsFileName, position: member.pos },
								});
							}
						});
					}
				});

				return {
					isIncomplete: false,
					items: completions,
				};
			},
		};
	},
});

function getComponentClassFromTemplateDocument(uri: string, tsService: ts.LanguageService, program: ts.Program): string | undefined {
	const globalScope = program.getCompilerOptions().baseUrl || program.getCurrentDirectory();
	const templatePath = uriToPath(uri);
	const checker = program?.getTypeChecker();
	if (!checker) return undefined;


	for (const sourceFile of tsService.getProgram()?.getSourceFiles() || []) {
		if (sourceFile.fileName.includes(globalScope) && sourceFile.fileName.endsWith('.ts')) {
			const type = checker.getTypeAtLocation(sourceFile);
			if (type && type.symbol) {
				for (const decl of type.symbol.declarations || []) {
					if (ts.isModuleDeclaration(decl)) {
						const body = decl.body;
						if (body && ts.isModuleBlock(body)) {
							for (const statement of body.statements) {
								if (ts.isClassDeclaration(statement) && statement.modifiers) {
									for (const decorator of statement.modifiers) {
										if (ts.isDecorator(decorator)) {
											const call = decorator.expression;
											if (ts.isCallExpression(call) && call.arguments.length) {
												for (const arg of call.arguments) {
													if (ts.isStringLiteral(arg) && arg.text === templatePath) {
														return sourceFile.fileName;
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	return undefined;
}

function uriToPath(uri: string): string {
	return uri.replace(/^file:\/\//, '').replace(/%3A/g, ':').replace(/\//g, path.sep);
}
