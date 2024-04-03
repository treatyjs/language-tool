import ts from 'typescript';
import { CompletionItem, CompletionItemKind, ServicePlugin, ServicePluginInstance } from '@volar/language-server';
import { Provide } from 'volar-service-typescript';
import path from 'path';

export const angularService: ServicePlugin = {
	name: 'angular-service',
	create(context): ServicePluginInstance {
		return {
			provideCompletionItems(document, position, token) {
				const languageService = context.inject<Provide, 'typescript/languageService'>(
					'typescript/languageService'
				);
				if (!languageService) return;

				const tsProgram = languageService.getProgram();

				const [file, sourceFile] = context.documents.getVirtualCodeByUri(document.uri);


				const tsFileName = getComponentClassFromTemplateDocument(document.uri, languageService, tsProgram!);
				if (!tsFileName) {
					return;
				}

				const getSourceFile1 = tsProgram?.getSourceFile(tsFileName);
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
};

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
