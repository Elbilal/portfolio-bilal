---
var: demo
aliases: test, sandbox
string: a quoted string
number: 42
boolean: true
short:
  - one
  - two
list:
  - arrays become lists
  - short ones stay on one line
---
## demo

This file is a sandbox — edit `terminal/demo.md` and type `demo` to see the
result. Everything between the `---` lines becomes the **const** above;
everything below is printed here.

- **bold** text and `inline code`
- links: [projects section](#projects) or [github](https://github.com/bilal-eng-dv)
- long bullet lines can wrap onto
  a second line in the source

Copy `terminal/_template.md` to start a new command.
