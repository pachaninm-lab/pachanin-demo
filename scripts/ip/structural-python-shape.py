"""Emits the shape of a Python file: its AST node types in pre-order, nothing else.

Identifiers, strings, numbers, comments and formatting are discarded by
construction - `ast` never sees comments, and only the node type is read, never
the name it carries. Two files with the same output have the same syntactic
shape whatever anything in them is called.

Reads newline-separated paths on stdin, writes one JSON object per line so a
file that fails to parse costs one line and not the run.
"""
import ast
import json
import sys


def shape(tree):
    out = []
    stack = [tree]
    while stack:
        node = stack.pop()
        out.append(type(node).__name__)
        children = list(ast.iter_child_nodes(node))
        stack.extend(reversed(children))
    return out


def main():
    for line in sys.stdin:
        path = line.rstrip("\n")
        if not path:
            continue
        try:
            with open(path, "rb") as handle:
                source = handle.read()
            tree = ast.parse(source)
        except (SyntaxError, ValueError, OSError, MemoryError, RecursionError) as error:
            sys.stdout.write(json.dumps({"path": path, "error": type(error).__name__}) + "\n")
            continue
        sys.stdout.write(json.dumps({"path": path, "shape": shape(tree)}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    sys.setrecursionlimit(20000)
    main()
