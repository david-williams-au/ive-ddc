/**
 * @NApiVersion 2.1
 */
define(
  [
    'N/record'
  ],

  (
    record
  ) => {

    class ConstantsModule {

      get RECORDS() {

        return {

          TRANSACTIONS:
          {

            INVOICE:
            {

              ID: record.Type.INVOICE,

              FIELDS:
              {
                CUSTOMER:
                {

                  ID: 'entity'

                },

                SUBSIDIARY:
                {

                  ID: 'subsidiary'

                }
              }
            }

          },

          CUSTOMER:
          {

            ID: record.Type.CUSTOMER,

            FIELDS:
            {

              CREDIT_LIMIT:
              {

                ID: 'creditlimit'

              },

              PRISM_STATUS:
              {

                ID: 'custentity_prism_status',

                TEXTS:
                {
                  AUTHORISATION: 'Authorisation',
                  OKAY: 'Okay',
                  OKAY_FOR_QJ: 'Okay_for_QJ',
                  ONHOLD: 'OnHold',
                  QUOTE_AND_DESPATCH: 'Quote and despatch',
                  QUOTE_ONLY: 'Quote only'
                },

                VALUES:
                {
                  AUTHORISATION: 3,
                  OKAY: 1,
                  OKAY_FOR_QJ: 6,
                  ONHOLD: 2,
                  QUOTE_AND_DESPATCH: 4,
                  QUOTE_ONLY: 5
                }

              },

              NAME:
              {
                ID: 'entityid'
              }

            }
          },

          CREDIT_CHECK_REQ:
          {

            ID: 'customrecord_ive_clc_cred_lim_chk',

            FIELDS:
            {

              CUSTOMER:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_customer'

              },

              SOURCE_TRANSACTION:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_source'

              },


              ISINACTIVE:
              {

                ID: 'isinactive'

              },

              RECEIVED:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_datetime'

              },

              PROCESSED:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_done'

              },

              FAILED:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_failed'

              },

              RESULT:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_result'

              },

              IGNORED:
              {

                ID: 'custrecord_ive_clc_cred_lim_chk_ignored'

              }

            }
          }

        };
      }

      get SCRIPTS() {

        return {

          CREDIT_CHECK_TRIGGER:
          {

            SCRIPT_ID: 'customscript_ive_clc_cred_chk_trig',

            DEPLOY_ID: 'customdeploy_ive_clc_cred_chk_trig',

            PARAMS:
            {

              SOURCE_TRANSACTION_SUBSIDIARY:
              {

                ID: 'custscript_ive_clc_cred_chk_trig_sub'

              }

            }

          },

          CHECK_CREDIT_LIMIT:
          {

            SCRIPT_ID: 'customscript_ive_clc_check_credit_limit',

            DEPLOY_ID: 'customdeploy_ive_clc_check_credit_limit',

            PARAMS:
            {

            }

          }
        };
      }

      get SEARCHES() {

        return {

          CUSTOMER_BALANCE:
          {

            ID: 'customsearch_ive_clc_customer_balance'

          }

        };

      }
    }

    const module = new ConstantsModule();

    return module;

  }
);