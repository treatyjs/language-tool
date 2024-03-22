import { CodeMapping, ExtraServiceScript, forEachEmbeddedCode, type LanguagePlugin, type VirtualCode } from '@volar/language-core';
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
					getVirtualTsFile(snapshot.getText(0, snapshot.getLength())),
					getVirtualHtmlFile(snapshot.getText(0, snapshot.getLength())),
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
	const angularHtmlRegex = /<([A-Za-z0-9\-_]+)(\s+[^>]*?(\{\{.*?\}\}|[\[\(]\(?.+?\)?[\]\)]|[\*\#][A-Za-z0-9\-_]+=".*?"))*[\s\S]*?<\/\1>/g;
	let modifyCode = code;

	// Track removed ranges to adjust TypeScript content positions
	let removedRanges: { start: number; end: number; }[] = [];



	const noneTSCode = [...code.matchAll(angularHtmlRegex)];

	for (let i = 0; i < noneTSCode.length; i++) {
		const ingnoreCode = noneTSCode[i];
		if (ingnoreCode.index !== undefined) {
			const matchText = ingnoreCode[1];
			const offset = ingnoreCode.index + ingnoreCode[0].indexOf(matchText);
			removedRanges.push({ start: offset, end: offset + matchText.length });
			modifyCode.replace(matchText, '');
		}
	}

	removedRanges.sort((a, b) => a.start - b.start);

	const adjustPosition = (pos: number) => {
		for (let range of removedRanges) {
			if (pos > range.end) {
				pos -= (range.end - range.start);
			} else if (pos > range.start) {
				pos = range.start;
				break;
			}
		}
		return pos;
	};

	let mappings = [];
	if (removedRanges.length > 0) {
		let startPos = adjustPosition(0);
		let endPos = adjustPosition(modifyCode.length);
		mappings.push({
			sourceOffsets: [startPos],
			generatedOffsets: [0],
			lengths: [endPos - startPos],
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
		id: 'script_ts',
		languageId: 'typescript',
		snapshot: {
			getText(start, end) {
				return code.substring(start, end);
			},
			getLength() {
				return code.length;
			},
			getChangeRange() {
				return undefined;
			},
		},
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

