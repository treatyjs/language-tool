import { treaty } from './treaty';
import { create as createHtmlService } from 'volar-service-html';
import { create as createCssService } from 'volar-service-css';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { createServer, createConnection, createTypeScriptProjectProviderFactory, Diagnostic, VirtualCode, loadTsdkByPath } from '@volar/language-server/node';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale);
	return server.initialize(
		params,
		createTypeScriptProjectProviderFactory(tsdk.typescript, tsdk.diagnosticMessages),
		{
			watchFileExtensions: ['treaty'],
			getLanguagePlugins() {
				return [treaty];
			},
			getServicePlugins() {
				return [
					createCssService(),
					createHtmlService(),
					...createTypeScriptServices(tsdk.typescript),
				];
			},
		},
	);
});


connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
