# Pydantic type generation for graphql

`graphql-codegen-pydantic` is a plugin for [`graphql-codegen`](https://graphql-code-generator.com/docs/getting-started/)
 that generates [pydantic](https://pydantic-docs.helpmanual.io/) types from any graphql schema

## Example

```graphql
type Book {
  title: String
  author: Author
}

type Author {
  name: String
  books: [Book]
}
```

becomes

```python
from typing import Optional, List
from pydantic import BaseModel


class Author(BaseModel):
    name: Optional[str]
    books: Optional[List[Optional['Book']]]


class Book(BaseModel):
    title: Optional[str]
    author: Optional['Author']
```

## Warning

`graphql-codegen-pydantic` is currently still very experimental and is **not ready for production use**

## Installation

1. Set up [`graphql-codegen`](https://graphql-code-generator.com/docs/getting-started/)
2. Install `graphql-codegen-pydantic`
```shell
yarn add graphql-codegen-pydantic -D
```
3. Add python file to `codegen.yml`
```yml
schema: http://localhost:3000/graphql
generates:
  ./src/schema.py:
    plugins:
      - pydantic
```

## Limitations

Currently very limited
1. No configuration supported
1. No comments included in generated code
1. No support for documents
1. No resolver support for eg graphene or ariadne
1. Properties converted to `snake_case`
