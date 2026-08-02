import re
import os

files = [
    'src/components/OrderModal/orderModalPrint.ts',
    'src/components/OrderModal/useOrderActions.ts'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    content = re.sub(r'\\\${', '${', content)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
