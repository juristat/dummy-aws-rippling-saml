const Promise = require('bluebird');
const AWS = require('aws-sdk');
const xml2js = require('xml2js');
const program = require('commander');
const promptly = require('promptly');
const inquirer = require('inquirer');
const rp = require('request-promise');
const colors = require('colors');
const _ = require('lodash');

// const credentials = {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// }

// AWS.config = new AWS.Config({
//     credentials,
//     region:process.env.AWS_REGION
// });

const listRoles = (iam) => new Promise((resolve, reject) => {
  iam.listRoles({}, (err, data) => {
    if (err) {
      reject(err);
    }
    resolve(data.Roles);
  });
})

const assumeRoleWithSAML = (sts, params) => new Promise((resolve, reject) => {
    sts.assumeRoleWithSAML(params, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  })

program.version('0.0.1');

program
  .command('list-roles')
  .description('List all AWS roles')
  .option('-u, --username <username>', 'The user to authenticate as')
  .action(async (options) => {
     let username;
     if (!_.isNil(options.username)) {
        console.log(`Authenticating ${options.username}`);
     } else {
        username = await promptly.prompt('Please enter your username: ');
     }
     const iam = new AWS.IAM();
     await Promise.resolve()
                  .then(async () => await listRoles(iam))
                  .tap((roles) => roles.forEach((role, idx) => console.log(`${role.Arn}`.cyan)))
                  .catch(err => console.log(`Error while listing IAM roles: ${err.message}`.red))
  })

program
  .command('assume-role')
  .description('Assume an AWS role')
  .option('-u, --username <username>', 'The user to authenticate as')
  .action(async (options) => {
    if (!_.isNil(options.username)) {
      console.log(`Authenticating ${options.username}`);
    }
    const iam = new AWS.IAM();
    await Promise.resolve()
                 .then(async () => await listRoles(iam))
                 .then((roles) => {
                   const question = [
                     {
                       type: 'list',
                       name: 'roleToAssume',
                       message: 'Please choose the role you would like to assume:',
                       choices: roles.map(role => role.Arn)
                     }
                   ]
                   return inquirer.prompt(question)
                                  .then(answer => answer.roleToAssume);
                 })
                 .tap(async (roleSelection) => {
                      const apiHeaders = {
                        'Authorization': 'Bearer DpM3EoXZ9znNuI9MAcmNOR201xRKJu',
                        'Company': '5b86e9027ee7665338513b79',
                        'Role': '5b8ff248f0fe931e3e6d20ed'
                      };
                      const sts = new AWS.STS();
                      const result = await rp({
                        url: 'https://app.rippling.com/api/platform/api/saml_service_provider/saml_rippling_initiated_sso_as_user',
                        qs: {
                          appName: 'Aws'
                        },
                        method: 'GET',
                        headers: apiHeaders,
                      });

                      const formattedXMLResult = result.replace(/\<head\>.*\<\/head\>/, '').replace(/^\"/, '').replace(/\"$/, '').replace(/\\\"/g, '"');
                      
                      const opts = {
                        explicitChildren: true,
                        preserveChildrenOrder: true,
                        charsAsChildren: true,
                      };

                      const parsedXML = await Promise.fromCallback(cb => xml2js.parseString(formattedXMLResult, opts, cb));
                      const samlAssertion = _.get(parsedXML, 'body.$$[0].$$[0].$.value') || '';
                      const params = {
                          PrincipalArn: 'arn:aws:iam::906002469002:saml-provider/Rippling-5b9808f0573d2079202fa6b6',
                          RoleArn: roleSelection,
                          SAMLAssertion: samlAssertion,
                      }
                      const assumedRole = await assumeRoleWithSAML(sts, params);
                      console.log(assumedRole);
                 })
                 .catch(err => console.log(`Error while listing IAM roles: ${err.message}`.red))
})

program.parse(process.argv);

// const params = {
//   MaxItems: 10
// };


// const creds = new AWS.EnvironmentCredentials('AWS');
// console.log(creds);

// console.log(samlcredentials);