import { TextDocumentEdit } from '@volar/language-server';
import type { CodeAction, ServiceContext } from '@volar/language-service';
import { TreatyVirtualCode } from '../../treaty';
import { AngularHtmlVirtualCode } from '../../html';
import { AngularTypescriptVirtualCode } from '../../angular';

export function enhancedProvideCodeActions(codeActions: CodeAction[], context: ServiceContext) {
	return codeActions.map((codeAction) => mapCodeAction(codeAction, context));
}

export function enhancedResolveCodeAction(codeAction: CodeAction, context: ServiceContext) {
	/**
	 * TypeScript code actions don't come through here, as they're considered to be already fully resolved
	 * A lot of the code actions we'll encounter here are more tricky ones, such as fixAll or refactor
	 * For now, it seems like we don't need to do anything special here, but we'll keep this function around
	 */
	return mapCodeAction(codeAction, context);
}

function mapCodeAction(codeAction: CodeAction, context: ServiceContext) {
	if (!codeAction.edit || !codeAction.edit.documentChanges) return codeAction;

	codeAction.edit.documentChanges = codeAction.edit.documentChanges.map((change) => {
		if (TextDocumentEdit.is(change)) {
			const [virtualFile, source] = context.documents.getVirtualCodeByUri(change.textDocument.uri);
			const code = source?.generated?.code;
			if (!virtualFile || !(code instanceof TreatyVirtualCode) && (code instanceof AngularHtmlVirtualCode && code instanceof AngularTypescriptVirtualCode)) return change;

		}

		return change;
	});

	return codeAction;
}
