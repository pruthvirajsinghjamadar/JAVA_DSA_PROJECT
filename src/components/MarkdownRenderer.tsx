import React from "react";

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function renderMarkdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "";
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  let i = 0;

  const endPara = () => {
    if (para.length) {
      html += "<p>" + inline(para.join(" ")) + "</p>";
      para = [];
    }
  };

  const endList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^(~~~|```)\s*(\w*)\s*$/);
    if (fence) {
      endPara();
      endList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[1])) {
        code.push(lines[i++]);
      }
      i++;
      html += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
      continue;
    }

    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      endPara();
      endList();
      const n = m[1].length + 1;
      html += `<h${n}>${inline(m[2])}</h${n}>`;
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      endPara();
      if (list !== "ul") {
        endList();
        html += "<ul>";
        list = "ul";
      }
      html += "<li>" + inline(m[1]) + "</li>";
    } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      endPara();
      if (list !== "ol") {
        endList();
        html += "<ol>";
        list = "ol";
      }
      html += "<li>" + inline(m[1]) + "</li>";
    } else if (!line.trim()) {
      endPara();
      endList();
    } else {
      endList();
      para.push(line.trim());
    }
    i++;
  }

  endPara();
  endList();
  return html;
}

export function MarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  const html = renderMarkdownToHtml(content);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
