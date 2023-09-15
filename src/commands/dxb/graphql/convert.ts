import { SfdxCommand, flags } from "@salesforce/command";

const SOQLSTRUCTURE = {
  select: /SELECT\s(.*?)\b\sFROM/i,
  from: /FROM\s(.*?)\b\sWHERE|\b\sORDER\sBY|\b\sLIMIT/i,
  where: /WHERE\s(.+?)(?=(?:\b\sGROUP\sBY|\b\sHAVING|\b\sORDER\sBY|\b\sLIMIT)|$)/i,
  groupBy: /GROUP\sBY\s(.*?)\b\sHAVING|\b\sORDER\sBY|\b\sLIMIT/i,
  having: /HAVING\s(.*?)\b\sORDER\sBY|\b\sLIMIT/i,
  orderBy: /ORDER\sBY\s(.*?)\b\sLIMIT/i,
  limit: /LIMIT\s(\d+)/i
};

const OPERATORS = {"=":"eq","!=":"ne","<":"lt",">":"gt","<=":"lte",">=":"gte","INCLUDES":"includes","EXCLUDES":"excludes","LIKE":"like"};

interface Filter {
  [key: string]: string | number | boolean | Filter | Filter[];
}

function convertWhereClause(sqlWhere: string): Filter[] {
  const stack: Filter[] = [];
  let currentFilter: Filter[] = [];
  let currentOperator: 'and' | 'or' = 'and';
  const pushFilter = () => {
    if (currentFilter && currentFilter.length > 0) {
      stack.push({ [currentOperator]: currentFilter });
      currentFilter = [];
    }
  };
  //WHERE ( Amount > 10000 OR Amount < 500 ) AND StageName = 'Contactend'
  const processToken = (token: string, index: number, tokens: string[]) => {
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



export default class extends SfdxCommand {
  public static description =
    "This command generate delta package by doing git diff.";

  public static examples = [` sfdx dxb:apex:scan:query -m tags -k mytag`];

  public static args = [{ name: "file" }];

  protected static flagsConfig = {
    query: flags.string({
      char: "q",
      description: "SOQL query",
      required: true
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;
  public async run() {
    // this.evaluate("(Amount > 10000 OR Amount < 500) AND StageName = 'Contacted'");
    const soqlQuery = this.flags.query;
    const graphqlQuery = this.convertSOQLToGraphQL(soqlQuery);
    console.log(graphqlQuery);
  }
  private splitSQLQuery(query) {
    const result = {};

    for (const section in SOQLSTRUCTURE) {
      const regex = SOQLSTRUCTURE[section];
      const match = query.match(regex);
      if (match) {
        result[section] = match[1].trim();
      }
    }
    return result;
  }
  public convertSOQLToGraphQL(soqlQuery: string): string {
    const fieldRegex = /([\w.]+)/g;

    const structuredQuery: any = this.splitSQLQuery(soqlQuery);
    if (!structuredQuery || !structuredQuery.select || !structuredQuery.from) {
      throw new Error("Invalid SOQL query format");
    }

    const objectName = structuredQuery.from;
    //select clause
    const fields = structuredQuery.select.match(fieldRegex);
    const graphqlFields = fields.map((field) => {
      if (field.toLocaleLowerCase() === "id") {
        return field;
      } else if (field.indexOf(".") >= 0) {
        const nestedFields = field.split(".");
        return nestedFields.reduceRight(
          (acc, curr) => `${curr} { ${acc} }`,
          "value"
        );
      } else {
        return `${field} { value }`;
      }
    });
    //where clause
    let graphqlConditions;
    if (structuredQuery.where) {
      graphqlConditions = convertWhereClause(structuredQuery.where);
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
      ? "first:" + structuredQuery.limit
      : "";
    if (graphqlConditions) {
      objectParams += objectParams.length > 0 ? "," : ""; //add comma if there is already object params
      objectParams += `where: ${JSON.stringify(graphqlConditions)}`;
    }
    if (objectParams){
      objectParams = `(${objectParams})`;
    }
    const graphqlQuery = `${objectName}${objectParams}{
        edges {
            node{
                ${graphqlFields.join("\n")}
            }
        }
    }`;

    return graphqlQuery;
  }
}



  // private evaluate(expression: string): string {
  //   if (!expression.includes("(")) {
  //     return;
  //   }

  //   let indexOfOpen = -1;
  //   let indexOfClose = -1;

  //   const chars = expression.split("");
  //   for (let i = 0; i < chars.length; i++) {

  //     if (chars[i] === "(") {
  //       indexOfOpen = i;
  //       continue;
  //     }

  //     if (chars[i] === ")") {
  //       indexOfClose = i;
  //       break;
  //     }
  //   }

  //   const subExpression = expression.substring(indexOfOpen + 1, indexOfClose);
  //   expression = expression.replace(
  //     "(" + subExpression + ")",
  //     String(this.evaluateExpression(subExpression))
  //   );
  //   this.evaluate(expression);
  // }

  // public evaluateExpression(expression: string): boolean {
  //   let result = false;
  //   for (const conj of expression.trim().split("OR")) {
  //     let b = true;
  //     for (const single of conj.split("AND")) {
  //       b = b && Boolean(single.trim());
  //     }
  //     result = result || b;
  //   }
  //   return result;
  // }