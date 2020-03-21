import { Types, mergeOutputs } from '@graphql-codegen/plugin-helpers';
import {
  buildSchema,
  parse,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
} from 'graphql';

import { plugin } from '../src/index';

describe('Pydantic', () => {
  it('Should work with types', async () => {
    const schema = buildSchema(/* GraphQL */ `
      "this is b"
      type B {
        id: ID
      }
      "this is c"
      type C {
        id: ID
      }
    `);
    const result = await plugin(
      schema,
      [],
      {},
      // { outputFile: '' },
    );

    expect(result).toEqual(false);
  });
});
