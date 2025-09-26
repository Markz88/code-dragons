import ast, multiprocessing as mp, traceback, builtins as _bi

SAFE_BUILTINS = {
    'abs': abs, 'all': all, 'any': any, 'bool': bool, 'dict': dict, 'enumerate': enumerate,
    'filter': filter, 'float': float, 'int': int, 'len': len, 'list': list, 'map': map,
    'max': max, 'min': min, 'pow': pow, 'range': range, 'repr': repr, 'reversed': reversed,
    'round': round, 'set': set, 'sum': sum, 'tuple': tuple, 'zip': zip, 'print': print,
    'str': str, 'isinstance': isinstance, 'super': super, 'sorted': sorted, 'type': type, 'hasattr': hasattr, 'callable': callable,
    '__build_class__': _bi.__build_class__,
    'object': object,
    'Exception': Exception, 'ValueError': ValueError, 'TypeError': TypeError, 'IndexError': IndexError
}

class Guard(ast.NodeVisitor):
    def visit_Attribute(self, node):
        if isinstance(node.attr, str) and node.attr.startswith('__') and node.attr != '__init__':
            raise ValueError("Uso di attributi speciali non permesso")
        self.generic_visit(node)
    def visit_Import(self, node): raise ValueError("Import non permesso")
    def visit_ImportFrom(self, node): raise ValueError("Import non permesso")
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id in ('open','exec','eval','compile','__import__'):
            raise ValueError(f"Chiamata non permessa: {node.func.id}")
        self.generic_visit(node)

def _run(code: str, tests: list[str]):
    tree = ast.parse(code, mode='exec')
    Guard().visit(tree)
    compiled = compile(tree, '<student>', 'exec')
    env = {'__builtins__': SAFE_BUILTINS, '__name__': '__main__'}
    exec(compiled, env, env)

    failures = []
    for t in tests:
        try:
            exec(t, env, env)
        except Exception as e:
            failures.append({
                'test': t,
                'error': ''.join(traceback.format_exception_only(type(e), e)).strip()
            })
    return failures

# ---------- TARGET A LIVELLO DI MODULO (picklabile con spawn) ----------
def _sandbox_target(code: str, tests: list[str], q: "mp.Queue") -> None:
    try:
        failures = _run(code, tests)
        q.put({'ok': True, 'failures': failures})
    except Exception as e:
        q.put({'ok': False, 'error': str(e), 'traceback': traceback.format_exc()})

def run_safely(code: str, tests: list[str], timeout_sec: int = 4):
    # Usa esplicitamente lo start method 'spawn' (portabile; su Linux equivale al default 'fork' solo se lo forzi)
    ctx = mp.get_context("spawn")
    q = ctx.Queue()

    p = ctx.Process(target=_sandbox_target, args=(code, tests, q), daemon=True)
    p.start()
    p.join(timeout=timeout_sec)

    if p.is_alive():
        p.terminate()
        p.join(1)
        return {'ok': False, 'timeout': True, 'error': 'Timeout di esecuzione'}

    # Se il figlio è morto senza mettere nulla in coda, restituisci un errore pulito
    if q.empty():
        return {'ok': False, 'error': 'Nessun risultato dal sandbox', 'exitcode': p.exitcode}

    return q.get()
