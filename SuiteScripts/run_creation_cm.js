/**
 * @NApiVersion 2.1
 */
define(['N/runtime', './lib/moment.min', './lib/ns.utils'],
  /**
* @param{runtime} runtime
*/
  (runtime, moment, ns_utils) => {

    const getRemainingUsage = () => runtime.getCurrentScript().getRemainingUsage()

    // Date object values turned into string in map entry point function
    const parseDateValueFields = target => {
      Object.keys(target).forEach(fieldId => {
        if (fieldId.match(/date|lastmodified/gi)) {
          target[fieldId] = ns_utils.systemDateFormat(target[fieldId], 'd')
        } else if (fieldId == 'sublist') {
          Object.keys(target[fieldId]).forEach((sublistId) => {
            for (i in target[fieldId][sublistId]) {
              Object.keys(target[fieldId][sublistId][i]).forEach((colId, j) => {
                if (colId.match(/date|lastmodified/gi)) {
                  ns_utils.systemDateFormat(target[fieldId][sublistId][i][colId], 'd')
                }
              })
            }
          })
        }
      })
    }

    // Unparse date to original string format
    const unParseDateValueFields = target => {
      Object.keys(target).forEach(fieldId => {
        if (fieldId.match(/date|lastmodified/gi)) {
          target[fieldId] = ns_utils.systemDateFormat(new Date(target[fieldId]), 's')
        } else if (fieldId == 'sublist') {
          Object.keys(target[fieldId]).forEach((sublistId) => {
            for (i in target[fieldId][sublistId]) {
              Object.keys(target[fieldId][sublistId][i]).forEach((colId, j) => {
                if (colId.match(/date|lastmodified/gi)) {
                  ns_utils.systemDateFormat(new Date(target[fieldId][sublistId][i][colId]), 's')
                }
              })
            }
          })
        }
      })
    }

    return { getRemainingUsage, parseDateValueFields, unParseDateValueFields }

  });