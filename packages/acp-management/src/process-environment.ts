const inheritedEnvironmentKeys = new Set([
    "ALL_PROXY",
    "APPDATA",
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
    "COLORTERM",
    "COMSPEC",
    "FORCE_COLOR",
    "HOME",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LOCALAPPDATA",
    "LOGNAME",
    "NO_COLOR",
    "NO_PROXY",
    "PATH",
    "PATHEXT",
    "SHELL",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SystemRoot",
    "TEMP",
    "TERM",
    "TMP",
    "TMPDIR",
    "USER",
    "USERNAME",
    "USERPROFILE",
    "WINDIR",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
]);
const providerEnvironmentPrefixes = [
    "ANTHROPIC_",
    "AWS_",
    "AZURE_OPENAI_",
    "BEDROCK_",
    "COHERE_",
    "DEEPSEEK_",
    "GEMINI_",
    "GOOGLE_",
    "GROQ_",
    "MISTRAL_",
    "OPENAI_",
    "OPENCODE_",
    "OPENROUTER_",
    "VERTEX_",
    "XAI_",
];

export function createAcpProcessEnvironment(parent: NodeJS.ProcessEnv, overrides: Record<string, string> = {}): NodeJS.ProcessEnv {

    const environment: NodeJS.ProcessEnv = {};
    for (const [
        key,
        value,
    ] of Object.entries(parent)) {
        if (value !== undefined && (inheritedEnvironmentKeys.has(key) || providerEnvironmentPrefixes.some(prefix => {

            return key.startsWith(prefix);
        }))) {
            environment[key] = value;
        }
    }

    return {
        ...environment,
        ...overrides,
    };
}
