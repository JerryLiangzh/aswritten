export const usageSections: Array<{ id: string; title: string; markdown: string }> = [
  {
    id: 'markdown-basics',
    title: 'Markdown 基础',
    markdown: String.raw`
直接编写 Markdown 源码，右侧预览会同步更新。标题使用井号，强调、列表、引用和链接使用标准 Markdown 语法。

~~~markdown
# 一级标题

正文包含 **粗体**、*斜体* 和 > 引用。

- 无序列表项
- 另一个列表项

[链接文字](https://example.com)
~~~
`,
  },
  {
    id: 'formula-delimiters',
    title: '行内公式与独立公式',
    markdown: String.raw`
行内公式使用单个美元符包裹，公式与正文保持在同一行。

~~~markdown
勾股定理为 $a^2+b^2=c^2$。
~~~

独立公式使用两个美元符包裹，适合单独展示较长的推导。

~~~markdown
$$
\int_a^b f(x)\,dx
$$
~~~

公式助手的行内／独立模式只影响之后的新插入内容，不会批量改写已有公式。
`,
  },
  {
    id: 'template-editing',
    title: '模板修改',
    markdown: String.raw`
在公式助手的“模板”分类中插入分式、根式、上下标、求和、积分、矩阵或分段函数。模板会直接进入唯一的 Markdown 编辑区，把占位内容替换为实际表达式即可。

~~~tex
\frac{a}{b}
\sqrt{x}
\begin{matrix}a&b\\c&d\end{matrix}
~~~

例如把分式中的 a 改为 x+1、把 b 改为 y，不需要打开其他公式输入框。
`,
  },
  {
    id: 'escaped-dollar',
    title: '转义美元符',
    markdown: String.raw`
表示价格等普通美元符时，在美元符前添加反斜杠，避免它被识别为公式分隔符。

~~~markdown
价格为 \$5，公式为 $x+1$。
~~~

行内代码和 fenced code block 中的美元符按代码处理，不会触发公式插入规则。
`,
  },
  {
    id: 'katex-support',
    title: 'KaTeX 支持范围',
    markdown: String.raw`
本应用使用 KaTeX 渲染公式。常用数学符号、希腊字母、上下标、分式、根式、求和、积分、矩阵、分段环境，以及颜色和相对字号命令均可使用，具体命令以当前 KaTeX 版本的支持范围为准。

KaTeX 不是完整的 LaTeX 文档编译器。依赖额外宏包的命令、文档级环境和 TeX Live 专属能力不在支持范围内，不要为网页公式添加完整 LaTeX 文档结构。
`,
  },
  {
    id: 'style-scope',
    title: '字号与颜色',
    markdown: String.raw`
颜色提供 red、blue、green，字号提供 small、large、Large、huge、Huge。点击样式会把对应 LaTeX 命令写入源码，而不是只改变预览。

选中内容后点击样式会包裹选区；没有选区时会插入空的作用域，光标停在命令后的空格处，可继续输入。花括号限定作用域，样式只影响其中的内容，不会修改后续内容或其他公式。

~~~tex
{\color{red} x+y}
{\Large x+y}
~~~
`,
  },
  {
    id: 'formula-errors',
    title: '错误公式排查',
    markdown: String.raw`
错误公式会保留在 Markdown 原文中。预览出现局部错误时，按以下顺序检查：

- 检查单个或双个美元分隔符是否成对，普通货币美元符是否已转义。
- 检查花括号是否配对，例如 \frac 需要两个参数：\frac{a}{b}。
- 检查 \begin 与 \end 的环境名称是否一致，矩阵列分隔符和换行是否正确。
- 确认命令属于 KaTeX 支持范围，并缩短公式逐项定位无法渲染的命令。

~~~tex
\frac{a}{b}
\begin{cases}a,&x>0\\b,&x\leq 0\end{cases}
~~~
`,
  },
]
