import { CodeMapping, ExtraServiceScript, forEachEmbeddedCode, type LanguagePlugin, type VirtualCode } from '@volar/language-core';
import ts from 'typescript';
import * as html from 'vscode-html-languageservice';

export const treaty: LanguagePlugin = {
	createVirtualCode(_id, languageId, snapshot) {
		if (languageId === 'treaty') {
			return {
				id: 'root',
				languageId,
				snapshot,
				embeddedCodes: [
					...getVirtualCssFiles(snapshot.getText(0, snapshot.getLength())),
					getVirtualTsFile(snapshot.getText(0, snapshot.getLength())),
					getVirtualHtmlFile(snapshot.getText(0, snapshot.getLength())),
				].filter((v): v is VirtualCode => !!v),
				mappings: [{
					sourceOffsets: [0],
					generatedOffsets: [0],
					lengths: [snapshot.getLength()],
					data: {
						completion: true,
						format: true,
						navigation: true,
						semantic: true,
						structure: true,
						verification: true,
					},
				}],
				codegenStacks: []
			};
		}
	},
	updateVirtualCode(_fileId, virtualCode, snapshot) {
		virtualCode.snapshot = snapshot;
		virtualCode.embeddedCodes = [
			...getVirtualCssFiles(snapshot.getText(0, snapshot.getLength())),
			getVirtualTsFile(snapshot.getText(0, snapshot.getLength())),
			getVirtualHtmlFile(snapshot.getText(0, snapshot.getLength())),
		].filter((v): v is VirtualCode => !!v);
		return virtualCode;
	},
	typescript: {
		extraFileExtensions: [{ extension: 'treaty', isMixedContent: true, scriptKind: 7 satisfies ts.ScriptKind.Deferred }],
		getScript() {
			return undefined;
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
	const angularHtmlRegex = /<([A-Za-z0-9\-_]+)(\s+[^>]*?(\{\{.*?\}\}|[\[\(]\(?.+?\)?[\]\)]|[\*\#][A-Za-z0-9\-_]+=".*?"))*[\s\S]*?<\/\1>/g;

	let modifiedCode = code;
	let mappings: CodeMapping[] = [];

	// First, remove CSS content and collect its mappings
	modifiedCode = modifiedCode.replace(cssRegex, (match, lang, css, offset) => {
		// Skip CSS content, but record its position for mapping adjustments
		const startOffset = offset;
		const endOffset = startOffset + match.length;
		mappings.push({
			sourceOffsets: [startOffset],
			generatedOffsets: [0], // No content generated for CSS blocks
			lengths: [endOffset - startOffset],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		});
		return ''; // Remove the CSS content
	});

	// Process HTML (Angular templates) and adjust mappings accordingly
	let totalRemovedLength = 0;
	modifiedCode = modifiedCode.replace(angularHtmlRegex, (match, p1, p2, offset) => {
		const startOffset = offset - totalRemovedLength;
		const endOffset = startOffset + match.length;
		totalRemovedLength += match.length;

		// Adjust mappings for HTML content
		mappings.push({
			sourceOffsets: [offset],
			generatedOffsets: [startOffset], // Adjust based on removed content
			lengths: [match.length],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		});
		return match; // Keep the HTML content
	});

	// Create a virtual code object for TypeScript based on modifiedCode
	return {
		id: 'script_ts',
		languageId: 'typescript',
		snapshot: ts.ScriptSnapshot.fromString(modifiedCode),
		mappings,
		embeddedCodes: [],
	};
}



function getVirtualHtmlFile(code: string): VirtualCode {
	const angularHtmlRegex = /<(?!style)([A-Za-z0-9\-_]+)(\s+[^>]*?(\{\{.*?\}\}|[\[\(]\(?.+?\)?[\]\)]|[\*\#][A-Za-z0-9\-_]+=".*?"))*[\s\S]*?<\/\1>/g;

	let mappings = [];
	let totalContent = '';
	let totalRemovedLength = 0;
	let matchStarts = [];
	let matchEnds = [];

	let matches;
	while ((matches = angularHtmlRegex.exec(code)) !== null) {
		const [fullMatch] = matches;
		const startOffset = matches.index;
		const endOffset = startOffset + fullMatch.length;

		matchStarts.push(startOffset - totalRemovedLength);
		matchEnds.push(endOffset - totalRemovedLength);

		totalContent += fullMatch;
		totalRemovedLength += code.substring(0, endOffset).length - fullMatch.length;
	}

	for (let i = 0; i < matchStarts.length; i++) {
		mappings.push({
			sourceOffsets: [matchStarts[i]],
			generatedOffsets: [matchStarts[i]],
			lengths: [matchEnds[i] - matchStarts[i]],
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

	// const document = html.TextDocument.create('', 'html', 0, totalContent);
	// const htmlDocument = htmlLs.parseHTMLDocument(document)

	return {
		id: 'html',
		languageId: 'html',
		snapshot: {
			getText: (start, end) => totalContent.substring(start, end),
			getLength: () => totalContent.length,
			getChangeRange: () => undefined,
		},
		mappings: mappings,
		embeddedCodes: [],
		// htmlDocument,
	};
}

