import '@graphql-codegen/testing';
import { buildSchema } from 'graphql';

import { plugin } from '../src/index';

describe('Pydantic', () => {
  it('basic Object', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type A {
        id: ID
      }
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from typing import Optional
    from pydantic import BaseModel
    
    
    class A(BaseModel):
        id: Optional[str]
    `);
  });

  it('basic Enum', async () => {
    const schema = buildSchema(/* GraphQL */ `
      enum Type {
        FIRST
        SECOND
        THIRD
      }
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from enum import Enum
    from pydantic import BaseModel


    class Type(str, Enum):
        FIRST = 'FIRST'
        SECOND = 'SECOND'
        THIRD = 'THIRD'
    `);
  });

  it('basic Union', async () => {
    const schema = buildSchema(/* GraphQL */ `
      union U = String | Int
    `);

    const result = await plugin(schema, [], {});

    // @todo fix the Optional import
    expect(result).toBeSimilarStringTo(`
    from typing import Optional, Union
    from pydantic import BaseModel


    U = Union[str, int]
    `);
  });

  it('basic Interface', async () => {
    const schema = buildSchema(/* GraphQL */ `
      interface Node {
        id: ID!
      }

      type Post implements Node {
        id: ID!
        title: String!
        description: String
      }
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from typing import Optional
    from pydantic import BaseModel


    class Node(BaseModel):
        id: str


    class Post(Node):
        id: str
        title: str
        description: Optional[str]
    `);
  });

  it('interface with union', async () => {
    const schema = buildSchema(/* GraphQL */ `
      interface Node {
        id: ID!
      }

      interface BasePost {
        id: ID!
        title: String!
      }

      type TextPost implements Node & BasePost {
        id: ID!
        title: String!
        description: String
      }

      type ImagePost implements Node & BasePost {
        id: ID!
        title: String!
        source: String!
      }

      union Post = TextPost | ImagePost
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from typing import Optional, Union
    from pydantic import BaseModel


    class BasePost(BaseModel):
        id: str
        title: str


    class Node(BaseModel):
        id: str


    class ImagePost(Node, BasePost):
        id: str
        title: str
        source: str


    Post = Union['TextPost', 'ImagePost']


    class TextPost(Node, BasePost):
        id: str
        title: str
        description: Optional[str]
    `);
  });

  it('custom scalar defaults to Any', async () => {
    const schema = buildSchema(/* GraphQL */ `
      scalar JSON

      type Blob {
        data: JSON
      }
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from typing import Any
    from pydantic import BaseModel


    class Blob(BaseModel):
        data: Any
    `);
  });

  it('correctly aliases pydantic reserved properties', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type AliasMe {
        copy: Int
      }
    `);

    const result = await plugin(schema, [], {});

    expect(result).toBeSimilarStringTo(`
    from typing import Optional
    from pydantic import BaseModel, Field


    class AliasMe(BaseModel):
        copy_: Optional[int] = Field(None, alias='copy')
    `);
  });
});
