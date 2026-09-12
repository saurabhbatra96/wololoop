/* A deliberately small Markdown renderer - enough for problem statements,
 * no CDN dependency. Everything is escaped before any tag is inserted. */

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, (_, code) => "<code>" + code + "</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(source) {
  const lines = escapeHtml(source).split("\n");
  const out = [];
  let i = 0;
  let paragraph = [];

  const flush = () => {
    if (paragraph.length) {
      out.push("<p>" + inline(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      out.push('<pre class="code' + (lang ? " lang-" + lang : "") + '"><code>' + body.join("\n") + "</code></pre>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      out.push("<blockquote>" + renderMarkdown(body.join("\n")) + "</blockquote>");
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      flush();
      const tag = bullet ? "ul" : "ol";
      const items = [];
      const pattern = bullet ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+(.*)$/;
      while (i < lines.length) {
        const match = lines[i].match(pattern);
        if (match) {
          items.push(match[1]);
          i += 1;
        } else if (/^\s+\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += " " + lines[i].trim();
          i += 1;
        } else {
          break;
        }
      }
      out.push("<" + tag + ">" + items.map((t) => "<li>" + inline(t) + "</li>").join("") + "</" + tag + ">");
      continue;
    }

    if (/^\s*$/.test(line)) {
      flush();
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flush();
  return out.join("\n");
}
