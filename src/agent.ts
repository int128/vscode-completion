import { Agent } from '@mastra/core/agent'
import * as vscode from 'vscode'

export class InlineCompletionAgent {
  private readonly contextLineSize = 30
  private agent

  static async create(configuration: InlineCompletionAgentConfiguration) {
    return new InlineCompletionAgent(await InlineCompletionAgent.createAgent(configuration), configuration)
  }

  private constructor(agent: Agent, configuration: InlineCompletionAgentConfiguration) {
    this.agent = agent
    configuration.onDidChange(async () => {
      this.agent = await InlineCompletionAgent.createAgent(configuration)
    })
  }

  private static async createAgent(configuration: InlineCompletionAgentConfiguration) {
    const { providerId, modelId } = configuration.get()
    const apiKey = await configuration.getApiKey()
    return new Agent({
      id: 'inline-code-completion',
      name: 'inline-code-completion',
      instructions: `
You are an inline code completion engine.
Fill in the code that belongs EXACTLY at the insertion point between the provided PREFIX and SUFFIX.

Strict Rules:
1. Output ONLY the raw code to be inserted at the cursor position.
2. Do NOT wrap the response in markdown code blocks (e.g. no \`\`\`typescript ... \`\`\`).
3. Do NOT repeat any code from the PREFIX or SUFFIX.
4. Do NOT provide explanations, comments, or conversational text.
5. If no completion is needed, output an empty string.
`,
      model: {
        providerId,
        modelId,
        apiKey,
      },
    })
  }

  async generate(document: vscode.TextDocument, position: vscode.Position, signal: AbortSignal) {
    const prefix = document.getText(
      new vscode.Range(new vscode.Position(Math.max(0, position.line - this.contextLineSize), 0), position),
    )
    const suffix = document.getText(
      new vscode.Range(position, new vscode.Position(position.line + this.contextLineSize, 0)),
    )
    const prompt = `
<PREFIX>
${prefix}
<SUFFIX>
${suffix}
<END>
`

    console.debug(`[vscode-completion] ${new Date().toISOString()}: generate()`)
    const response = await this.agent.generate(prompt, {
      abortSignal: signal,
      modelSettings: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        reasoning: 'low',
      },
    })
    console.debug(`[vscode-completion] ${new Date().toISOString()}: Total ${response.totalUsage.totalTokens} tokens`)
    if (signal.aborted) {
      return []
    }
    if (response.finishReason !== 'stop') {
      throw new Error(`Agent failed: ${response.finishReason}`)
    }

    return [new vscode.InlineCompletionItem(response.text, new vscode.Range(position, position))]
  }
}

export class InlineCompletionAgentConfiguration implements vscode.Disposable {
  private readonly extensionContext
  private readonly disposables: vscode.Disposable[] = []
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>()
  readonly onDidChange = this.onDidChangeEmitter.event

  constructor(extensionContext: vscode.ExtensionContext) {
    this.extensionContext = extensionContext
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('vscodeCompletion.agent')) {
          this.onDidChangeEmitter.fire()
        }
      }),
    )
  }

  get() {
    const configuration = vscode.workspace.getConfiguration('vscodeCompletion.agent')
    return {
      providerId: configuration.get<string>('providerId', ''),
      modelId: configuration.get<string>('modelId', ''),
    }
  }

  async getApiKey() {
    return await this.extensionContext.secrets.get('vscodeCompletion.agent.apiKey')
  }

  async setApiKey(value: string) {
    await this.extensionContext.secrets.store('vscodeCompletion.agent.apiKey', value)
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }
}
