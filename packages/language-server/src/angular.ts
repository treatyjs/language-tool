import { CodeInformation, LanguagePlugin, Mapping, forEachEmbeddedCode, type VirtualCode } from '@volar/language-core';
import path from 'path';
import type ts from 'typescript';


export function getTypescriptLanguageModule(ts: typeof import('typescript')): LanguagePlugin<AngularTypescriptVirtualCode> {
	return {
		createVirtualCode(fileId, languageId, snapshot) {
			if (languageId === 'typescript') {
				const text = snapshot.getText(0, snapshot.getLength());
				const ast = ts.createSourceFile(fileId, text, ts.ScriptTarget.Latest);
				return new AngularTypescriptVirtualCode(fileId, snapshot, ast, ts);
			}
		},
		updateVirtualCode(_fileId, angular, snapshot) {
			angular.update(snapshot)
			return angular;
		},
		typescript: {
			extraFileExtensions: [],
			getScript(code) {
				return {
					code,
					extension: '.ts',
					scriptKind: 3 satisfies ts.ScriptKind.TS,
				};
			},
		}
	};
}

export class AngularTypescriptVirtualCode implements VirtualCode {
	id = 'root';
	languageId = 'typescript';
	mappings!: Mapping<CodeInformation>[];
	embeddedCodes!: VirtualCode[];
	codegenStacks: VirtualCode['codegenStacks'] = [];

	constructor(
		public fileName: string,
		public snapshot: ts.IScriptSnapshot,
		public ast: ts.SourceFile,
		private ts: typeof import('typescript'),
	) {
		const gen = this.onSnapshotUpdated();
		this.snapshot = ts.ScriptSnapshot.fromString(gen.text);
		this.mappings = gen.mappings;
	}

	public update(snapshot: ts.IScriptSnapshot) {
		const text = snapshot.getText(0, snapshot.getLength());
		const change = snapshot.getChangeRange(this.snapshot);

		this.ast = change
			? this.ast.update(text, change)
			: this.ts.createSourceFile(this.fileName, text, this.ts.ScriptTarget.Latest);
		this.snapshot = snapshot;

		const gen = this.onSnapshotUpdated();
		this.snapshot = this.ts.ScriptSnapshot.fromString(gen.text);
		this.mappings = gen.mappings;
	}


	onSnapshotUpdated() {
		const ast = this.ast;
		const classComponents: {
			templateUrl?: string,
			selectorNode?: ts.StringLiteral,
			urlNodes: ts.Node[],
			decoratorName: string,
			className: string,
		}[] = [];

		ast.forEachChild(node => {
			if (this.ts.isClassDeclaration(node)) {
				if (node.modifiers?.find(mod => mod.kind === this.ts.SyntaxKind.ExportKeyword)) {
					const decorator = node.modifiers.find((mod) => this.ts.isDecorator(mod)) as ts.Decorator | undefined;
					if (
						decorator
						&& this.ts.isCallExpression(decorator.expression)
						&& decorator.expression.arguments.length
						&& this.ts.isObjectLiteralExpression(decorator.expression.arguments[0])
					) {
						const decoratorName = decorator.expression.expression.getText(ast);
						const className = node.name?.getText(ast) || '';
						const classComponent: typeof classComponents[number] = {
							className,
							decoratorName,
							urlNodes: [],
						};
						const selectorProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'selector');
						if (selectorProp && this.ts.isPropertyAssignment(selectorProp) && this.ts.isStringLiteral(selectorProp.initializer)) {
							classComponent.selectorNode = selectorProp.initializer;
						}
						const templateUrlProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'templateUrl');
						if (templateUrlProp && this.ts.isPropertyAssignment(templateUrlProp) && this.ts.isStringLiteral(templateUrlProp.initializer)) {
							const templateUrl = path.resolve(path.dirname(ast.fileName), templateUrlProp.initializer.text);
							classComponent.templateUrl = templateUrl;
							classComponent.urlNodes.push(templateUrlProp.initializer);
						}
						const styleUrlsProp = decorator.expression.arguments[0].properties.find((prop) => prop.name?.getText(ast) === 'styleUrls');
						if (styleUrlsProp && this.ts.isPropertyAssignment(styleUrlsProp) && this.ts.isArrayLiteralExpression(styleUrlsProp.initializer)) {
							for (const url of styleUrlsProp.initializer.elements) {
								if (this.ts.isStringLiteral(url)) {
									classComponent.urlNodes.push(url);
								}
							}
						}
						classComponents.push(classComponent);
					}
				}
			}
		});

		const codegen = new Codegen(ast.getText());

		codegen.addSourceText(0, ast.end);

		if (classComponents.length) {
			codegen.text += `\n/* Volar: Virtual Code */\n`;
			for (const classComponent of classComponents) {
				for (const urlNode of classComponent.urlNodes) {
					codegen.text += `import `;
					codegen.addSourceText(urlNode.getStart(ast), urlNode.getEnd());
					codegen.text += `;\n`;
				}
			}
			const classComponentsWithTemplateUrl = classComponents.filter(component => !!component.templateUrl);
			codegen.text += `declare global {\n`;
			if (classComponentsWithTemplateUrl.length) {
				codegen.text += `type __WithComponent<P extends string, C1, C2> = C1 extends import('@angular/core').Component ? { [k in P]: C2 } : {};\n`;
				codegen.text += `interface __Templates2Components extends\n`;
				codegen.text += classComponentsWithTemplateUrl.map((component) => {
					return `__WithComponent<'${component.templateUrl}', ${component.decoratorName}, ${component.className}>`;
				}).join(',\n');
				codegen.text += `\n{ }\n`;
			}
			const classComponentsWithSelector = classComponents.filter(component => !!component.selectorNode);
			if (classComponentsWithSelector.length) {
				codegen.text += `type __WithComponent2<P extends {}, C1> = C1 extends import('@angular/core').Component ? P : {};\n`;
				for (const classComponentWithSelector of classComponentsWithSelector) {
					codegen.text += `interface __Selectors2Components extends __WithComponent2<{ `;
					codegen.addSourceText(classComponentWithSelector.selectorNode!.getStart(ast), classComponentWithSelector.selectorNode!.getEnd());
					codegen.text += `: ${classComponentWithSelector.className} }, ${classComponentWithSelector.decoratorName}> { }\n`;
				}
			}
			codegen.text += `}\n`;
		}

		return codegen;
	}
}

export class Codegen {

	static validTsVar = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

	constructor(public sourceCode: string) { }

	public text = '';
	public mappings: VirtualCode['mappings'] = [];

	public addSourceText(start: number, end: number,) {
		this.mappings.push({
			sourceOffsets: [start, end],
			generatedOffsets: [start, end],
			lengths: [this.text.length, this.text.length + end - start],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		});
		const addText = this.sourceCode.substring(start, end);
		this.text += addText;
		return addText;
	}

	public addPropertyAccess(start: number, end: number) {
		if (Codegen.validTsVar.test(this.sourceCode.substring(start, end))) {
			this.text += `.`;
			this.addSourceText(start, end);
		}
		else {
			this.text += `[`;
			this.addSourceTextWithQuotes(start, end);
			this.text += `]`;
		}
	}

	public addObjectKey(start: number, end: number) {
		if (Codegen.validTsVar.test(this.sourceCode.substring(start, end))) {
			this.addSourceText(start, end);
		}
		else {
			this.addSourceTextWithQuotes(start, end);
		}
	}

	public addSourceTextWithQuotes(start: number, end: number) {
		this.addSourceText(start, start);
		this.text += `'`;
		this.addSourceText(start, end);
		this.text += `'`;
		this.addSourceText(end, end);
	}

}
