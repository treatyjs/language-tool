# WIP: Treaty language-tools

This is a work in progress of the treaty language tool. Currently it spilts the .treaty file into 3 embedded code (HTMl, Typescript and css)

We need to consider how to make this approachable for auto complete. They a good arguement to for a treaty to jsx for lanague service as it digest from angular authoring

## Running 
- Run `pnpm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`


## Build .vsix

- Run `pnpm run pack` in this folder
- `packages/vscode/vscode-treaty-0.0.1.vsix` will be created, and you can manual install it to VSCode.

## References

- https://code.visualstudio.com/api/language-extensions/embedded-languages
- https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-embedded-language-service
