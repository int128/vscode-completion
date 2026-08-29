import * as vscode from 'vscode'
import type { InlineCompletionAgentConfiguration } from './agent'

export class InlineCompletionStatus implements vscode.Disposable {
  private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  private readonly inlineCompletionAgentConfiguration

  constructor(inlineCompletionAgentConfiguration: InlineCompletionAgentConfiguration) {
    this.inlineCompletionAgentConfiguration = inlineCompletionAgentConfiguration
  }

  start() {
    const { providerId, modelId } = this.inlineCompletionAgentConfiguration.get()
    this.statusBarItem.text = `$(sync~spin) ${providerId}/${modelId}`
    this.statusBarItem.show()
  }

  finish() {
    this.statusBarItem.hide()
  }

  dispose() {
    this.statusBarItem.dispose()
  }
}
