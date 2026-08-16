import * as vscode from 'vscode'
import { InlineCompletionAgent, InlineCompletionAgentConfiguration } from './agent.ts'
import { InlineCompletionItemProvider } from './provider.ts'

export const activate = async (context: vscode.ExtensionContext) => {
  const inlineCompletionAgentConfiguration = new InlineCompletionAgentConfiguration(context)
  const inlineCompletionAgent = await InlineCompletionAgent.create(inlineCompletionAgentConfiguration)
  const inlineCompletionItemProvider = new InlineCompletionItemProvider(inlineCompletionAgent)

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      {
        pattern: '**',
      },
      inlineCompletionItemProvider,
    ),
    inlineCompletionAgentConfiguration,
    vscode.commands.registerCommand('vscodeCompletion.agent.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: '[Code Completion] Enter your API key for the LLM provider',
        password: true,
      })
      if (apiKey) {
        await inlineCompletionAgentConfiguration.setApiKey(apiKey)
        vscode.window.showInformationMessage('Saved your API key to the secret storage')
      }
    }),
  )
}
