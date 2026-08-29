import { setTimeout } from 'node:timers/promises'
import * as vscode from 'vscode'
import type { InlineCompletionAgent } from './agent.ts'

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  private readonly debouncer = new Debouncer(300)
  private readonly agent

  constructor(agent: InlineCompletionAgent) {
    this.agent = agent
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    cancellationToken: vscode.CancellationToken,
  ) {
    try {
      const cancellationController = new AbortController()
      cancellationToken.onCancellationRequested(() => cancellationController.abort())
      return await this.debouncer.run(
        cancellationController.signal,
        async () => await this.agent.generate(document, position, cancellationController.signal),
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return []
      }
      vscode.window.showErrorMessage(`Inline completion failed: ${error}`)
      throw error
    }
  }
}

class Debouncer {
  private cancelPreviousWait?: () => void
  private readonly delay

  constructor(delay: number) {
    this.delay = delay
  }

  async run<T>(externalSignal: AbortSignal, task: () => Promise<T>): Promise<T> {
    if (this.cancelPreviousWait) {
      this.cancelPreviousWait()
    }

    const currentWaitController = new AbortController()
    this.cancelPreviousWait = () => currentWaitController.abort()
    await setTimeout(this.delay, undefined, {
      signal: AbortSignal.any([currentWaitController.signal, externalSignal]),
    })

    return await task()
  }
}
