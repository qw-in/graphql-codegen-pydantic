import { parse, GraphQLSchema, printSchema, visit } from 'graphql';
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';

import { PydanticVisitor } from './visitor';
import { PydanticPluginRawConfig } from './config';

// eslint-disable-next-line import/prefer-default-export
export const plugin: PluginFunction<PydanticPluginRawConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: PydanticPluginRawConfig,
  info,
): Promise<string> => {
  const visitor = new PydanticVisitor(config, schema);
  const printedSchema = printSchema(schema);
  const astNode = parse(printedSchema);

  const visitorResult = visit(astNode, { leave: visitor as any });
  const imports = visitor.getImports();

  return `${imports}\n\n\n${visitorResult}\n`;
};
