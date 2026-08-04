import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => c.redirect("/hello-ai"));

app.get("/hello-ai", (c) =>
  c.html(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Workers AI</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, sans-serif;
      }
      body {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 20px;
      }
      label {
        display: block;
        margin-top: 20px;
        font-weight: 600;
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        margin-top: 8px;
        padding: 12px;
        font: inherit;
      }
      button {
        margin-top: 20px;
        padding: 10px 20px;
        font: inherit;
        cursor: pointer;
      }
      pre {
        min-height: 120px;
        padding: 16px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        border: 1px solid currentColor;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Workers AI</h1>
      <form id="ai-form">
        <label for="prompt">システムプロンプト</label>
        <textarea id="prompt" rows="5" maxlength="2000" required>あなたは親切なアシスタントです。日本語で簡潔に答えてください。</textarea>

        <label for="message">メッセージ</label>
        <textarea id="message" rows="10" maxlength="8000" placeholder="AIに送る内容を入力してください" required></textarea>

        <button id="submit-button" type="submit">送信</button>
      </form>

      <h2>応答</h2>
      <p>"@cf/qwen/qwen3-30b-a3b-fp8"</p>
      <pre id="output" aria-live="polite">ここに応答が表示されます。</pre>
    </main>

    <script>
      const form = document.querySelector("#ai-form");
      const prompt = document.querySelector("#prompt");
      const message = document.querySelector("#message");
      const output = document.querySelector("#output");
      const submitButton = document.querySelector("#submit-button");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        output.textContent = "生成中...";

        try {
          const response = await fetch("/hello-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: prompt.value,
              message: message.value,
            }),
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "リクエストに失敗しました");
          }

          output.textContent = result.response ?? JSON.stringify(result, null, 2);
        } catch (error) {
          output.textContent = error instanceof Error
            ? error.message
            : "通信に失敗しました";
        } finally {
          submitButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`),
);

app.post("/hello-ai", async (c) => {
  let body: { prompt?: unknown; message?: unknown };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON形式のリクエストを送信してください" }, 400);
  }

  if (typeof body.prompt !== "string" || typeof body.message !== "string") {
    return c.json({ error: "prompt と message は文字列で指定してください" }, 400);
  }

  const prompt = body.prompt.trim();
  const message = body.message.trim();

  if (!prompt || !message) {
    return c.json({ error: "prompt と message は必須です" }, 400);
  }

  if (prompt.length > 2_000 || message.length > 8_000) {
    return c.json({ error: "入力が長すぎます" }, 400);
  }

  try {
    const response = await c.env.AI.run(
      "@cf/qwen/qwen3-30b-a3b-fp8",
      {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
      },
    );

    return c.json(response);
  } catch (error) {
    console.error("AI実行エラー:", error);
    return c.json({ error: "AIの応答を取得できませんでした" }, 500);
  }
});

export default app;
