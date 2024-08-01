/**
 * @NApiVersion 2.1
 */
define(
  [
    'N/record',
    'N/search',
    'common',
    './constants',
    './data'
  ],

  /**
   * @param {record} record
   * @param {search} search
   * @param {CommonModule} common
   * @param {ConstantsModule} constants
   * @param {DataModule} data
   */

  (
    record,
    search,
    common,
    constants,
    data
  ) => {

    class CustomerBalanceSearchResult {

      constructor(result) {

        this.balance = 0.0;

        try {

          let balanceColumn = null;

          result.columns.forEach(
            (element) => {

              if (util.isString(element.label) && (element.label.trim() !== '')) {

                if (element.label.toUpperCase() === 'BALANCE') {

                  balanceColumn = element;

                }

              }

            }
          );

          if (balanceColumn === null) {

            // Someone has edited the saved search and messed it up

            throw new Error('The balance column expected in the saved search can not be found');

          }

          this.balance = Number(result.getValue(balanceColumn));

        } catch (e) {

          this.balance = false;

          common.logErr('emergency', e);

        }

      }

    }

    class AccountsReceivableModule {

      /**
       * Performs a search to tally up the customer's open A/R transactions to determine their current balance.
       * Returns the balance if successful or false if an error occurs.
       * Requires 15 governance units
       * @param {number|string} customerId
       * @returns {number|boolean}
       */
      getCustomerBalance(customerId) {

        let balance = 0.0;

        try {

          common.enterContext('getCustomerBalance'); // getCustomerBalance

          common.logVal('debug', 'customerId', customerId);

          let srch =

            // governance 5 units

            search.load(
              {
                type: search.Type.TRANSACTION,
                id: constants.SEARCHES.CUSTOMER_BALANCE.ID
              }
            );

          common.logVal('debug', 'srch', srch);

          srch.filters =
            srch.filters.concat(
              [
                search.createFilter(
                  {
                    name: constants.RECORDS.TRANSACTIONS.INVOICE.FIELDS.CUSTOMER.ID,
                    operator: search.Operator.ANYOF,
                    values:
                      [
                        customerId
                      ]
                  }
                )
              ]
            );

          common.logVal('debug', 'srch.filters', srch.filters);

          let results =

            // governance 10 units

            data.getSearchResults(srch, CustomerBalanceSearchResult);

          common.logVal('debug', 'results', results);

          if (results === false) {

            throw new Error('Balance search failed to return results');

          }

          if (results.length > 1) {

            throw new Error('Balance search returned ' + results.length + ' results');

          }

          balance = ((results.length === 0) ? 0.0 : results[0].balance);

          if (!util.isNumber(balance)) {

            throw new Error('Balance search returned a non-numeric balance');

          }

        } catch (e) {

          balance = false;

          common.logErr('error', e);

        } finally {

          common.leaveContext(); // getCustomerBalance

        }

        common.logVal('debug', 'balance', balance);

        return balance;

      }

      /**
       * Gets the customer's credit limit and performs some additional checks on the value.
       * Returns the credit limit if successful and has a value, null if successful but has no value set, or false if an error occurs.
       * Requires 5 governance units
       * @param {number|string} customerId
       * @returns {number|null|boolean}
       */
      getCustomerCreditLimit(customerId) {

        let creditLimit = false;

        try {

          common.enterContext('A/R Module'); // AccountsReceivableModule
          common.enterContext('getCustomerCreditLimit'); // getCustomerCreditLimit

          let customer =

            // governance 5 units

            record.load(
              {
                type: record.Type.CUSTOMER,
                id: customerId
              }
            );

          creditLimit =
            customer.getValue(
              {
                fieldId: 'creditlimit'
              }
            );

          common.logVal('debug', 'raw creditLimit', creditLimit);

          if (
            (creditLimit === '') ||
            (creditLimit === null)
          ) {

            // Credit limit has no value

            common.logMsg('debug', 'Credit limit has no value');

            creditLimit = null;

          } else {

            creditLimit = Number(creditLimit);

            if (isNaN(creditLimit)) {

              common.logMsg('debug', 'Invalid credit limit');

              creditLimit = false;

            } else {

              common.logMsg('debug', 'Valid credit limit');

            }

          }

        } catch (e) {

          creditLimit = false;

          common.logErr('error', e);

        } finally {

          common.leaveContext(); // getCustomerCreditLimit
          common.leaveContext(); // AccountsReceivableModule

        }

        common.logVal('debug', 'creditLimit', creditLimit);

        return creditLimit;

      }

    }

    return new AccountsReceivableModule();

  }
);