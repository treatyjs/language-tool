import { getTreatyLanguageModule } from './treaty';
import { AngularHtmlVirtualCode, getAngularHtmlLanguageModule } from './html';
import { getTypescriptLanguageModule } from './angular';
import { create as createHtmlService } from 'volar-service-html';
import { create as createCssService } from 'volar-service-css';
import { create as createEmmetService } from 'volar-service-emmet';
import { create as createTypeScriptServices } from './plugin/typescript'
import { create as createTypeScriptTwoSlashService } from 'volar-service-typescript-twoslash-queries';

import { createServer, createConnection, createTypeScriptProjectProviderFactory, Diagnostic, VirtualCode, loadTsdkByPath, Connection } from '@volar/language-server/node';
import { angularService } from './plugin/angular';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {

	const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale);





	return server.initialize(
		params,
		createTypeScriptProjectProviderFactory(tsdk.typescript, tsdk.diagnosticMessages),
		{

			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', 'treaty', 'html'],
			getLanguagePlugins() {
				return [
					getTreatyLanguageModule(),
					getAngularHtmlLanguageModule(tsdk.typescript),
					getTypescriptLanguageModule(tsdk.typescript)
				];
			},

			getServicePlugins() {
				return [
					createHtmlService(),
					createCssService(),
					createEmmetService(),
					...createTypeScriptServices(tsdk.typescript),
					createTypeScriptTwoSlashService(tsdk.typescript),
					angularService(tsdk.typescript),
					{
						create(context) {
							return {
								provideDiagnostics(document) {
									const virtualCode = context.documents.getVirtualCodeByUri(document.uri)[0] as VirtualCode | AngularHtmlVirtualCode | undefined;

									if (virtualCode instanceof AngularHtmlVirtualCode) {
										return (virtualCode.parsed.errors ?? []).map<Diagnostic>(error => ({
											range: {
												start: { line: error.span.start.line, character: error.span.start.col },
												end: { line: error.span.end.line, character: error.span.end.col },
											},
											severity: error.level === 1 ? 1 : 2,
											source: 'ng-template',
											message: error.msg,
										}));
									}
								},
							}
						},
					},
				];
			},
		},
	);
});


connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
