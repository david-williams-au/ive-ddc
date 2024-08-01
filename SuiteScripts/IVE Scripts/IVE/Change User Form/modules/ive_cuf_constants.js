/**
 * @NApiVersion 2.1
 */
define(
  [
  ],

  () => {

    const module =
    {
      REQUEST_PARAM_IDS:
      {
        CHANGE_FORM: 'cf'
      },

      CONFIG_RECORD:
      {
        TYPE_ID: 'customrecord_ive_cuf_role_form',

        FIELD_IDS:
        {
          IS_INACTIVE: 'isinactive',
          SUBSIDIARY: 'custrecord_ive_cuf_role_form_subsidiary',
          USER_ROLE: 'custrecord_ive_cuf_role_form_role',
          FORM: 'custrecord_ive_cuf_role_form_form'
        }
      },

      TRANSACTION:
      {
        FIELD_IDS:
        {
          SUBSIDIARY: 'subsidiary'
        }
      }
    };

    return module;

  }
)