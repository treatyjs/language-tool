import { ExtraServiceScript, forEachEmbeddedCode, type LanguagePlugin, type VirtualCode } from '@volar/language-core';
import ts from 'typescript';

export const treaty: LanguagePlugin = {
	createVirtualCode(_id, languageId, snapshot) {
		if (languageId === 'treaty') {
			return {
				id: 'root',
				languageId: 'treaty',
				snapshot,
				embeddedCodes: [
					...getVirtualCssFiles(snapshot.getText(0, snapshot.getLength())),
					getVirtualHtmlFile(snapshot.getText(0, snapshot.getLength())),
					getVirtualTsFile(snapshot.getText(0, snapshot.getLength())),
				].filter((v): v is VirtualCode => !!v),
				mappings: [],
				codegenStacks: []
			};
		}
	},
	updateVirtualCode(_fileId, virtualCode, snapshot) {
		virtualCode.snapshot = snapshot;
		virtualCode.embeddedCodes = [
			...getVirtualCssFiles(snapshot.getText(0, snapshot.getLength())),
			getVirtualHtmlFile(snapshot.getText(0, snapshot.getLength())),
			getVirtualTsFile(snapshot.getText(0, snapshot.getLength())),
		].filter((v): v is VirtualCode => !!v);
		return virtualCode;
	},
	typescript: {
		extraFileExtensions: [{ extension: 'treaty', isMixedContent: true, scriptKind: 7 satisfies ts.ScriptKind.Deferred }],
		getScript(rootVirtualCode) {
			for (const code of forEachEmbeddedCode(rootVirtualCode)) {
				if (code.id === 'ts') {
					return {
						code,
						scriptKind: 3,
						extension: '.ts',
					};
				}
			}
		},
		
		getExtraScripts(fileName, root) {
			const scripts: ExtraServiceScript[] = [];
			for (const code of forEachEmbeddedCode(root)) {
				if (code.languageId === 'javascript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.js',
						code,
						extension: '.js',
						scriptKind: 1 satisfies ts.ScriptKind.JS,
					});
				}
				else if (code.languageId === 'typescript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.ts',
						code,
						extension: '.ts',
						scriptKind: 3 satisfies ts.ScriptKind.TS,
					});
				}
			}
			return scripts;
		},
	},
};

function* getVirtualCssFiles(content: string): Generator<VirtualCode> {
	const cssRegex = /<style(?:\s+lang="(css|scss)")?[^>]*>([\s\S]*?)<\/style>/g;

	const styleBlocks = [...content.matchAll(cssRegex)];

	for (let i = 0; i < styleBlocks.length; i++) {
		const styleBlock = styleBlocks[i];
		if (styleBlock.index !== undefined) {
			const matchText = styleBlock[2];
			const lang = styleBlock[1] || 'css';
			yield {
				id: `${lang}_` + i,
				languageId: lang,
				snapshot: {
					getText(start, end) {
						return matchText.substring(start, end);
					},
					getLength() {
						return matchText.length;
					},
					getChangeRange() {
						return undefined;
					},
				},
				mappings: [
					{
						sourceOffsets: [styleBlock.index + styleBlock[0].indexOf(matchText)],
						generatedOffsets: [0],
						lengths: [matchText.length],
						data: {
							verification: true,
							completion: true,
							semantic: true,
							navigation: true,
							structure: true,
							format: true,
						},
					}
				],
				embeddedCodes: [],
			}
		}
	}
}
function getVirtualTsFile(code: string): VirtualCode {
	const cssRegex = /<style(?:\s+lang="(css|scss)")?[^>]*>([\s\S]*?)<\/style>/g;
	const angularHtmlRegex = /<(?!style)([A-Za-z0-9\-_]+)(\s+[^>]*?(\{\{.*?\}\}|[\[\(]\(?.+?\)?[\]\)]|[\*\#][A-Za-z0-9\-_]+=".*?"))*[\s\S]*?<\/\1>/g;

	let lastMatchEnd = 0;
	const matches = [...code.matchAll(cssRegex), ...code.matchAll(angularHtmlRegex)];
	let combinedCode = '';
	let mappings = [];
	let offsetAdjustment = 0;

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		if (match.index > lastMatchEnd) {
			const snippet = code.substring(lastMatchEnd, match.index);
			const snippetStart = lastMatchEnd;
			const snippetEnd = match.index;

			combinedCode += snippet;

			mappings.push({
				sourceOffsets: [snippetStart],
				generatedOffsets: [offsetAdjustment],
				lengths: [snippetEnd - snippetStart],
				data: {
					completion: true,
					format: true,
					navigation: true,
					semantic: true,
					structure: true,
					verification: true,
				},
			});

			offsetAdjustment += snippet.length;
		}
		lastMatchEnd = match.index + match[0].length;
	}

	if (lastMatchEnd < code.length) {
		const snippet = code.substring(lastMatchEnd);
		combinedCode += snippet;
		mappings.push({
			sourceOffsets: [lastMatchEnd],
			generatedOffsets: [offsetAdjustment],
			lengths: [snippet.length],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		});
	}

	return {
		id: 'combined_ts',
		languageId: 'typescript',
		snapshot: {
			getText(start, end) {
				return combinedCode.substring(start, end);
			},
			getLength() {
				return combinedCode.length;
			},
			getChangeRange() {
				return undefined;
			},
		},
		mappings: mappings,
		embeddedCodes: [],
	};
}
function getVirtualHtmlFile(code: string): VirtualCode {
	const angularHtmlRegex = /<(?!style)([A-Za-z0-9\-_]+)(\s+[^>]*?(\{\{.*?\}\}|[\[\(]\(?.+?\)?[\]\)]|[\*\#][A-Za-z0-9\-_]+=".*?"))*[\s\S]*?<\/\1>/g;

	let combinedHtml = '';
	let mappings = [];
	let offsetAdjustment = 0;

	const htmlBlocks = [...code.matchAll(angularHtmlRegex)];

	for (let i = 0; i < htmlBlocks.length; i++) {
		const htmlBlock = htmlBlocks[i];
		const matchText = htmlBlock[0];
		const originalOffset = htmlBlock.index !== undefined ? htmlBlock.index : 0;

		combinedHtml += matchText;

		mappings.push({
			sourceOffsets: [originalOffset],
			generatedOffsets: [offsetAdjustment],
			lengths: [matchText.length],
			data: {
				verification: true,
				completion: true,
				semantic: true,
				navigation: true,
				structure: true,
				format: true,
			},
		});

		offsetAdjustment += matchText.length;
	}

	return {
		id: 'combined_html',
		languageId: 'html',
		snapshot: {
			getText(start, end) {
				return combinedHtml.substring(start, end);
			},
			getLength() {
				return combinedHtml.length;
			},
			getChangeRange() {
				return undefined;
			},
		},
		mappings: mappings,
		embeddedCodes: [],
	};
}

