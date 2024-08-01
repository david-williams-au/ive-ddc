/**
* JCSP Library
*/

define(["N/record",
  "N/log",
  "N/transaction",
  "N/search",
  "N/format"],
  Main);

function Main(
  record,
  log,
  transaction,
  search,
  format) {

  function SEARCHID(type) {
    var obj = {};
    return obj[type];
  }

  /**
   * 
   * @param {*} id : search id in NS
   * @param {*} type : record type to search, null if custom record
   * @param {*} fltrs : search filters
   */
  function LoadSearch(id, type, fltrs) {
    try {
      var mySearch = search.load({
        id: id,
        type: type
      });

      if (!isEmpty(fltrs)) {
        for (each in fltrs) {
          log.debug({ title: 'UTIL : fltr', details: fltrs[each] });
          mySearch.filters.push(fltrs[each]);
        }
      }


      var results = mySearch.run().getRange(0, 1000);
      if (isEmpty(results)) return null;
      var completeResultSet = results; //copy the results
      var start = 1000;
      var last = 2000;
      //if there are more than 1000 records
      while (results.length == 1000) {
        results = mySearch.run().getRange(start, last);
        completeResultSet = completeResultSet.concat(results);
        start = parseFloat(start) + 1000;
        last = parseFloat(last) + 1000;
      }

      results = completeResultSet;
      //log.debug({title: 'results length',details: results.length,});

      return results;
    } catch (ex) {
      log.debug({ title: 'LoadSearch Exception', details: ex });
    }
  }

  function isEmpty(val) {
    if (val == null || val == 'null' || val == undefined || val == '' || val == ' ' || val == 0 || val == 'undefined' || val === 'undefined' || val === undefined) {
      return true;
    }
    return false;
  }

  function numberWithCommas(number) {
    var parts = number.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function GetSearchColumns(id, type) {
    var mySearch = search.load({
      id: id,
      type: type
    });

    var cols = mySearch.columns;

    return cols;
  }

  function lookupFields(type, id, flds) {
    try {
      var vals = search.lookupFields({
        type: search.Type[type],
        id: id,
        columns: flds
      });
      return vals;
    } catch (ex) {
      return null;
    }
  }


  return {
    isEmpty: isEmpty,
    LoadSearch: LoadSearch,
    GetSearchColumns: GetSearchColumns,
    numberWithCommas: numberWithCommas,
    lookupFields: lookupFields

  };
}