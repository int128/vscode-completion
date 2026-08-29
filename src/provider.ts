import { setTimeout } from 'node:timers/promises'
import * as vscode from 'vscode'
import type { InlineCompletionAgent } from './agent.ts'
import type { InlineCompletionStatus } from './status.ts'

export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  private readonly debouncer = new Debouncer(300)
  private readonly agent
  private readonly inlineCompletionStatus

  constructor(agent: InlineCompletionAgent, inlineCompletionStatus: InlineCompletionStatus) {
    this.agent = agent
    this.inlineCompletionStatus = inlineCompletionStatus
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    cancellationToken: vscode.CancellationToken,
  ) {
    if (!this.shouldTrigger(document, position)) {
      return []
    }
    const cancellationController = new AbortController()
    cancellationToken.onCancellationRequested(() => cancellationController.abort())
    try {
      return await this.debouncer.run(cancellationController.signal, async () => {
        this.inlineCompletionStatus.start()
        return await this.agent.generate(document, position, cancellationController.signal)
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return []
      }
      vscode.window.showErrorMessage(`Inline completion failed: ${error}`)
      throw error
    } finally {
      this.inlineCompletionStatus.finish()
    }
  }

  private shouldTrigger(document: vscode.TextDocument, position: vscode.Position): boolean {
    const prefix = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position))
    const onEmptyLine = prefix.trim() === ''
    if (onEmptyLine) {
      return true
    }
    const beforeSymbol = /[.,=<>:()[\]]\s*$/.test(prefix)
    if (beforeSymbol) {
      return true
    }
    const inComment = /^\s*[/#]/.test(prefix)
    if (inComment) {
      return true
    }
    return false
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
