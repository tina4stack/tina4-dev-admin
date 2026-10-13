/** Arithmetic oracle for numeric UI assertions. Parses literals/operators only; never evaluates JS. */
export function numericAssertion(expression:string):number {
 if(typeof expression!=='string' || expression.length>200)throw new Error('Invalid numeric assertion formula.');
 expression=expression.replace(/=\s*$/,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
 const tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/%\-]/gi)||[];
 if(tokens.join('')!==expression.replace(/\s/g,''))throw new Error('Use only numeric literals and arithmetic operators in an assertion formula.');
 let index=0;
 const atom=():number=>{
  const token=tokens[index++];
  if(token==='+' || token==='-')return (token==='-'?-1:1)*atom();
  if(token==='('){const value=sum();if(tokens[index++]!==')')throw new Error('Unclosed assertion formula.');return value;}
  if(token===undefined || !/^(?:\d|\.)/.test(token))throw new Error('Expected a numeric literal.');
  return Number(token);
 };
 const product=():number=>{let value=atom();while(['*','/','%'].includes(tokens[index])){const op=tokens[index++],right=atom();value=op==='*'?value*right:op==='/'?value/right:value%right;}return value;};
 const sum=():number=>{let value=product();while(['+','-'].includes(tokens[index])){const op=tokens[index++],right=product();value=op==='+'?value+right:value-right;}return value;};
 const value=sum();if(index!==tokens.length || !Number.isFinite(value))throw new Error('Assertion formula must produce a finite number.');return value;
}
