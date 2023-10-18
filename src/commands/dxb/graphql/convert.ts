import { Messages } from '@salesforce/core';
import {Flags, SfCommand } from '@salesforce/sf-plugins-core';

const OPERATORS: { [key: string]: string} = {'=':'eq','!=':'ne','<':'lt','>':'gt','<=':'lte','>=':'gte','INCLUDES':'includes','EXCLUDES':'excludes','LIKE':'like'};

type Filter = {
  [key: string]: string | number | boolean | Filter | Filter[];
}

function convertWhereClause(sqlWhere: string): Filter[] {
  const stack: Filter[] = [];
  let currentFilter: Filter[] = [];
  let currentOperator: 'and' | 'or' = 'and';
  const pushFilter = (): void => {
    if (currentFilter?.length > 0) {
      stack.push({ [currentOperator]: currentFilter });
      currentFilter = [];
    }
  };
  // WHERE ( Amount > 10000 OR Amount < 500 ) AND StageName = 'Contactend'
  const processToken = (token: string, index: number, tokens: string[]): void => {
    if (token === 'AND' || token === 'OR') {
      currentOperator = token.toLowerCase() as 'and' | 'or';
    } else if (token === '(') {
      pushFilter();
    } else if (token === ')') {
      {
        pushFilter();
        const poppedFilter = stack.pop();
        if (poppedFilter) {
          currentFilter = [poppedFilter];
        }
      }
    } else if (Object.keys(OPERATORS).includes(tokens[index + 1])) {
      const operator = tokens[index + 1];
      const value = tokens[index + 2];
      if (operator && value) {
        const condition: Filter = { [token]: { [OPERATORS[operator]]: value } };
        currentFilter.push(condition);
      }
    }

  };

  const tokens = sqlWhere.split(/\s+/);
  tokens.forEach(processToken);

  pushFilter();
  return stack;
}

type SOQLStructureType = {
  [index: string]: any;
  select?: string | RegExp;
  from?: string | RegExp;
  where?: string | RegExp;
  groupBy?: string | RegExp;
  having?: string | RegExp;
  orderBy?: string | RegExp;
  limit?: number | RegExp;
}
type GraphQlConvertResult = {
  graphqlQuery: string;
}

const SOQLSTRUCTURE: SOQLStructureType = {
  select: /SELECT\s(.*?)\b\sFROM/i,
  from: /FROM\s(.*?)\b\sWHERE|\b\sORDER\sBY|\b\sLIMIT/i,
  where: /WHERE\s(.+?)(?=(?:\b\sGROUP\sBY|\b\sHAVING|\b\sORDER\sBY|\b\sLIMIT)|$)/i,
  groupBy: /GROUP\sBY\s(.*?)\b\sHAVING|\b\sORDER\sBY|\b\sLIMIT/i,
  having: /HAVING\s(.*?)\b\sORDER\sBY|\b\sLIMIT/i,
  orderBy: /ORDER\sBY\s(.*?)\b\sLIMIT/i,
  limit: /LIMIT\s(\d+)/i
};

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('dxb', 'graphql.convert');
export default class GraphQlConvert extends SfCommand<GraphQlConvertResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    query: Flags.string({
      char: 'q',
      summary: messages.getMessage('flags.query.summary'),
      required: true
    })
  };

  public async run(): Promise<GraphQlConvertResult> {
    const {flags} = await this.parse(GraphQlConvert);
    const soqlQuery = flags.query;
    const graphqlQuery = this.convertSOQLToGraphQL(soqlQuery);
    return { graphqlQuery };
  }

  public convertSOQLToGraphQL(soqlQuery: string): string {
    const fieldRegex = /([\w.]+)/g;

    const structuredQuery: SOQLStructureType = this.splitSQLQuery(soqlQuery);
    if (!structuredQuery.select || !structuredQuery.from) {
      throw messages.createError('error.invalidSOQL');
    }

    const objectName = structuredQuery.from;
    // select clause
    const fields = (structuredQuery.select as string).match(fieldRegex);
    const graphqlFields = fields!.map((field) => {
      if (field.toLocaleLowerCase() === 'id') {
        return field;
      } else if (field.includes('.')) {
        const nestedFields = field.split('.');
        return nestedFields.reduceRight(
          (acc, curr) => `${curr} { ${acc} }`,
          'value'
          );
        } else {
          return `${field} { value }`;
        }
    });
    // where clause
    let graphqlConditions;
    if (structuredQuery.where) {
      graphqlConditions = convertWhereClause((structuredQuery.where as string));
    }
    /*
    uiapi {
      query {
        Account(where: { AnnualRevenue: { gte: $minAmount } }) {
          edges {
            node {
              Id
              Name {
                value
              }
              AnnualRevenue {
                displayValue
              }
            }
          }
        }
      }
    });
    */
    let objectParams = structuredQuery.limit
      ? 'first:' + structuredQuery.limit
      : '';
    if (graphqlConditions) {
      objectParams += objectParams.length > 0 ? ',' : ''; // add comma if there is already object params
      objectParams += `where: ${JSON.stringify(graphqlConditions)}`;
    }
    if (objectParams){
      objectParams = `(${objectParams})`;
    }
    return `${objectName}${objectParams}{
      edges {
        node{
          ${graphqlFields.join('\n')}
        }
      }
    }`;
  }

  // eslint-disable-next-line class-methods-use-this
  private splitSQLQuery(query: string ): SOQLStructureType {
    const result: SOQLStructureType = {
      select: undefined,
      from: undefined
    };
    for (const section in SOQLSTRUCTURE) {
      if (Object.prototype.hasOwnProperty.call(SOQLSTRUCTURE, section)) {
        const regex: RegExp = SOQLSTRUCTURE[section];
        const match = query.match(regex);
        if (match) {
          result[section] = match[1].trim();
        }
      }
    }
    return result;
  }
}