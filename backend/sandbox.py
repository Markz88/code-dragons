
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

def _run(code:str, tests:list[str]):
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
            failures.append({'test': t, 'error': ''.join(traceback.format_exception_only(type(e), e)).strip()})
    return failures

def run_safely(code:str, tests:list[str], timeout_sec:int=4):
    q = mp.Queue()
    def target():
        try:
            q.put({'ok': True, 'failures': _run(code, tests)})
        except Exception as e:
            q.put({'ok': False, 'error': str(e)})
    p = mp.Process(target=target)
    p.start()
    p.join(timeout=timeout_sec)
    if p.is_alive():
        p.terminate()
        return {'ok': False, 'timeout': True, 'error': 'Timeout di esecuzione'}
    return q.get() if not q.empty() else {'ok': False, 'error': 'Nessun risultato'}
