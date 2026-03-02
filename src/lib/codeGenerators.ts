import { HeaderItem } from "@/components/request-builder/HeadersEditor";
import { QueryParamItem } from "@/components/request-builder/QueryParamsEditor";
import { AuthConfig } from "@/components/request-builder/AuthEditor";
import { BodyType } from "@/components/request-builder/BodyEditor";

export interface RequestConfig {
  method: string;
  url: string;
  headers: HeaderItem[];
  queryParams: QueryParamItem[];
  auth: AuthConfig;
  body: string;
  bodyType: BodyType;
}

function buildFullUrl(config: RequestConfig): string {
  let url = config.url;
  const enabledParams = config.queryParams.filter((p) => p.enabled && p.key.trim());
  
  if (enabledParams.length > 0) {
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${queryString}`;
  }

  if (config.auth.type === "api-key" && config.auth.apiKey?.addTo === "query") {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${encodeURIComponent(config.auth.apiKey.key)}=${encodeURIComponent(config.auth.apiKey.value || "")}`;
  }

  return url;
}

function getAuthHeader(auth: AuthConfig): Record<string, string> {
  if (auth.type === "bearer" && auth.bearer?.token) {
    return { Authorization: `Bearer ${auth.bearer.token}` };
  }
  if (auth.type === "basic" && auth.basic?.username) {
    const encoded = btoa(`${auth.basic.username}:${auth.basic.password || ""}`);
    return { Authorization: `Basic ${encoded}` };
  }
  if (auth.type === "api-key" && auth.apiKey?.addTo === "header") {
    return { [auth.apiKey.key]: auth.apiKey.value || "" };
  }
  return {};
}

function getAllHeaders(config: RequestConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  
  config.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headers[h.key] = h.value;
    });

  Object.assign(headers, getAuthHeader(config.auth));
  
  return headers;
}

export function generateCurl(config: RequestConfig): string {
  const lines: string[] = [];
  const url = buildFullUrl(config);
  const headers = getAllHeaders(config);

  lines.push(`curl -X ${config.method} \\`);
  lines.push(`  '${url}'`);

  Object.entries(headers).forEach(([key, value]) => {
    lines.push(` \\\n  -H '${key}: ${value}'`);
  });

  if (["POST", "PUT", "PATCH"].includes(config.method) && config.bodyType !== "none" && config.body.trim()) {
    const escapedBody = config.body.replace(/'/g, "'\\''");
    lines.push(` \\\n  -d '${escapedBody}'`);
  }

  return lines.join("");
}

export function generateJavaScriptFetch(config: RequestConfig): string {
  const url = buildFullUrl(config);
  const headers = getAllHeaders(config);
  const hasBody = ["POST", "PUT", "PATCH"].includes(config.method) && config.bodyType !== "none" && config.body.trim();

  let code = `const response = await fetch('${url}', {\n`;
  code += `  method: '${config.method}',\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    Object.entries(headers).forEach(([key, value], index, arr) => {
      const comma = index < arr.length - 1 ? "," : "";
      code += `    '${key}': '${value}'${comma}\n`;
    });
    code += `  },\n`;
  }

  if (hasBody) {
    if (config.bodyType === "json") {
      code += `  body: JSON.stringify(${config.body}),\n`;
    } else {
      code += `  body: '${config.body.replace(/'/g, "\\'")}',\n`;
    }
  }

  code += `});\n\n`;
  code += `const data = await response.json();\n`;
  code += `console.log(data);`;

  return code;
}

export function generatePythonRequests(config: RequestConfig): string {
  const url = buildFullUrl(config);
  const headers = getAllHeaders(config);
  const hasBody = ["POST", "PUT", "PATCH"].includes(config.method) && config.bodyType !== "none" && config.body.trim();

  let code = `import requests\n\n`;
  code += `url = "${url}"\n`;

  if (Object.keys(headers).length > 0) {
    code += `headers = {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    "${key}": "${value}",\n`;
    });
    code += `}\n`;
  }

  if (hasBody) {
    if (config.bodyType === "json") {
      code += `payload = ${config.body}\n`;
    } else {
      code += `payload = """${config.body}"""\n`;
    }
  }

  code += `\nresponse = requests.${config.method.toLowerCase()}(\n`;
  code += `    url,\n`;
  
  if (Object.keys(headers).length > 0) {
    code += `    headers=headers,\n`;
  }
  
  if (hasBody) {
    code += config.bodyType === "json" ? `    json=payload,\n` : `    data=payload,\n`;
  }
  
  code += `)\n\n`;
  code += `print(response.status_code)\n`;
  code += `print(response.json())`;

  return code;
}

export function generateNodeAxios(config: RequestConfig): string {
  const url = buildFullUrl(config);
  const headers = getAllHeaders(config);
  const hasBody = ["POST", "PUT", "PATCH"].includes(config.method) && config.bodyType !== "none" && config.body.trim();

  let code = `const axios = require('axios');\n\n`;
  code += `const config = {\n`;
  code += `  method: '${config.method.toLowerCase()}',\n`;
  code += `  url: '${url}',\n`;

  if (Object.keys(headers).length > 0) {
    code += `  headers: {\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `    '${key}': '${value}',\n`;
    });
    code += `  },\n`;
  }

  if (hasBody) {
    code += `  data: ${config.body},\n`;
  }

  code += `};\n\n`;
  code += `axios(config)\n`;
  code += `  .then(response => console.log(response.data))\n`;
  code += `  .catch(error => console.error(error));`;

  return code;
}

export function generatePhpCurl(config: RequestConfig): string {
  const url = buildFullUrl(config);
  const headers = getAllHeaders(config);
  const hasBody = ["POST", "PUT", "PATCH"].includes(config.method) && config.bodyType !== "none" && config.body.trim();

  let code = `<?php\n\n`;
  code += `$curl = curl_init();\n\n`;
  code += `curl_setopt_array($curl, [\n`;
  code += `    CURLOPT_URL => "${url}",\n`;
  code += `    CURLOPT_RETURNTRANSFER => true,\n`;
  code += `    CURLOPT_CUSTOMREQUEST => "${config.method}",\n`;

  if (Object.keys(headers).length > 0) {
    code += `    CURLOPT_HTTPHEADER => [\n`;
    Object.entries(headers).forEach(([key, value]) => {
      code += `        "${key}: ${value}",\n`;
    });
    code += `    ],\n`;
  }

  if (hasBody) {
    const escapedBody = config.body.replace(/"/g, '\\"');
    code += `    CURLOPT_POSTFIELDS => '${escapedBody}',\n`;
  }

  code += `]);\n\n`;
  code += `$response = curl_exec($curl);\n`;
  code += `curl_close($curl);\n\n`;
  code += `echo $response;\n`;
  code += `?>`;

  return code;
}

export type CodeLanguage = "curl" | "javascript" | "python" | "node" | "php";

export const CODE_LANGUAGES: { id: CodeLanguage; name: string; icon: string }[] = [
  { id: "curl", name: "cURL", icon: "terminal" },
  { id: "javascript", name: "JavaScript Fetch", icon: "code" },
  { id: "python", name: "Python Requests", icon: "code" },
  { id: "node", name: "Node.js Axios", icon: "code" },
  { id: "php", name: "PHP cURL", icon: "code" },
];

export function generateCode(language: CodeLanguage, config: RequestConfig): string {
  switch (language) {
    case "curl":
      return generateCurl(config);
    case "javascript":
      return generateJavaScriptFetch(config);
    case "python":
      return generatePythonRequests(config);
    case "node":
      return generateNodeAxios(config);
    case "php":
      return generatePhpCurl(config);
    default:
      return "";
  }
}
