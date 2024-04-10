import {
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	ServiceContext,
} from '@volar/language-server';
import { TreatyVirtualCode } from '../../treaty.js';
import { AngularHtmlVirtualCode } from '../../html.js';
import { AngularTypescriptVirtualCode } from '../../angular.js';

export function enhancedProvideCompletionItems(completions: CompletionList): CompletionList {

	return completions;
}

export function enhancedResolveCompletionItem(
	resolvedCompletion: CompletionItem,
	context: ServiceContext
): CompletionItem {
	if (resolvedCompletion.data.isComponent) {
		resolvedCompletion.detail = getDetailForFileCompletion(
			resolvedCompletion.detail ?? '',
			resolvedCompletion.data.originalItem.source
		);
	}

	if (resolvedCompletion.additionalTextEdits) {
		const [virtualFile, source] = context.documents.getVirtualCodeByUri(
			resolvedCompletion.data.uri
		);
		const code = source?.generated?.code;
		if (!virtualFile || !(code instanceof TreatyVirtualCode) && (code instanceof AngularHtmlVirtualCode && code instanceof AngularTypescriptVirtualCode)) return resolvedCompletion;


	}

	return resolvedCompletion;
}

function getDetailForFileCompletion(detail: string, source: string): string {
	return `${detail}\n\n${source}`;
}