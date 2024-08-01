/**
 * @NApiVersion 2.1
 */
define(
  [
    'N/search',
    'common'
  ],

  /**
   * @param {search} search
   * @param {CommonModule} common
   * @param {object} constants
*/

  (
    search,
    common
  ) => {

    class Result {

      constructor(result) {

        try {

          common.enterContext('Result.constructor');

          this.id = Number(result.id);

          result.columns.forEach(
            (column, index) => {

              try {

                common.enterContext('column-' + column.name);

                this[column.name] = {};
                this[column.name].value = result.getValue(column);
                this[column.name].text = result.getText(column);

              } catch (e) {

                common.logErr('error', e);

              } finally {

                common.leaveContext();

              }

            }
          );

        } catch (e) {

          common.logErr('error', e);

        } finally {

          common.leaveContext();

        }

      }

    }

    class DataModule {

      constructor() {

      }

      get Result() {

        return Result;

      }

      /**
       * Runs the search and assembles the results into an Array.
       * Requires 5 + 5 * (# results / 1000) governance units
       * @param {search.Search} srch
       * @param {class} [resultClass]
       * @returns
       */
      getSearchResults(srch, resultClass) {

        common.enterContext('getSearchResults'); // getSearchResults

        common.logVal('debug', 'srch', srch);

        let _resultClass = Result;
        let results = [];
        let resultCount = 0;
        let errorCount = 0;

        if (resultClass) {

          _resultClass = resultClass;

        }

        try {

          // governance 5 units

          let pagedData = srch.runPaged({ pageSize: 1000 });
          let page;
          let obj;

          pagedData.pageRanges.forEach(
            (range) => {

              // governance 5 units

              page = pagedData.fetch({ index: range.index });

              page.data.forEach(
                (result, index) => {

                  common.enterContext('result[' + index + ']');

                  try {

                    obj = new _resultClass(result);

                    resultCount++;

                    common.logVal('debug', 'obj', obj);

                    results.push(obj);

                  } catch (e) {

                    errorCount++;

                    common.logErr('error', e);

                  } finally {

                    common.leaveContext();

                  }
                }
              );

            }
          );

        } catch (e) {

          results = false;
          common.logErr('error', e);

        }

        common.logVal('debug', 'results', results);
        common.logVal('debug', 'resultCount', resultCount);
        common.logVal('debug', 'errorCount', errorCount);

        if (errorCount > 0) {

          results = false;

        }

        common.logVal('debug', 'results', results);

        common.leaveContext(); // Function

        return results;

      }

    }

    return new DataModule();

  }
);