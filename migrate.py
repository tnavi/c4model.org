import re

html_path = r'C:\Users\arpeg\Downloads\index (1).html'
out_html = r'C:\Users\arpeg\.gemini\antigravity\scratch\c4model-org-website\index.html'
out_css = r'C:\Users\arpeg\.gemini\antigravity\scratch\c4model-org-website\styles.css'

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract CSS
css_match = re.search(r'(?s)<style>(.*?)</style>', content)
if not css_match:
    print('No CSS found!')
    exit(1)
css_content = css_match.group(1).strip()

# FIX CSS BUG
css_content = css_content.replace('[data-ja] { display: none; }', 'html[lang="en"] [data-ja] { display: none; }\nhtml[lang="ja"] [data-en] { display: none; }')

# Write CSS
with open(out_css, 'w', encoding='utf-8') as f:
    f.write(css_content)
print('Wrote styles.css')

# Build new HTML
body_match = re.search(r'(?s)<body>(.*?)<script>', content)
if not body_match:
    print('No Body found!')
    exit(1)
body_content = body_match.group(1).strip()

# Replace dojo-advanced.html with basho-case.html
body_content = body_content.replace('dojo-advanced.html', 'basho-case.html')

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>C4 Model Study Project — c4model.org</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,400&family=DM+Mono:wght@400;500&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/plantuml-encoder@1.4.0/dist/plantuml-encoder.min.js"></script>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
{body_content}
    <script src="script.js"></script>
</body>
</html>"""

with open(out_html, 'w', encoding='utf-8') as f:
    f.write(html_template)
print('Wrote index.html')
