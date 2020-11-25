import InputFieldComponent from '@lblod/ember-submission-form-fields/components/rdf-input-fields/input-field';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { triplesForPath } from '@lblod/submission-form-helpers';
import rdflib from 'browser-rdflib';
import { v4 as uuidv4 } from 'uuid';
import { RDF } from '@lblod/submission-form-helpers';

const MU = new rdflib.Namespace('http://mu.semte.ch/vocabularies/core/');

const applicationFormTableBaseUri = 'http://data.lblod.info/application-form-tables';
const applicationFormEntryBaseUri = 'http://data.lblod.info/application-form-entries';
const lblodSubsidieBaseUri = 'http://lblod.data.gift/vocabularies/subsidie/';
const extBaseUri = 'http://mu.semte.ch/vocabularies/ext/';

const ApplicationFormTableType = new rdflib.NamedNode(`${lblodSubsidieBaseUri}ApplicationFormTable`);
const ApplicationFormEntryType = new rdflib.NamedNode(`${extBaseUri}ApplicationFormEntry`);
const applicationFormTablePredicate = new rdflib.NamedNode(`${lblodSubsidieBaseUri}applicationFormTable`);
const applicationFormEntryPredicate = new rdflib.NamedNode(`${extBaseUri}applicationFormEntry`);
const actorNamePredicate = new rdflib.NamedNode('http://mu.semte.ch/vocabularies/ext/actorName');
const numberChildrenForFullDayPredicate = new rdflib.NamedNode('http://mu.semte.ch/vocabularies/ext/numberChildrenForFullDay');
const numberChildrenForHalfDayPredicate = new rdflib.NamedNode('http://mu.semte.ch/vocabularies/ext/numberChildrenForHalfDay');
const numberChildrenPerInfrastructurePredicate = new rdflib.NamedNode('http://mu.semte.ch/vocabularies/ext/numberChildrenPerInfrastructure');

const inputFieldNames = [
  'actorName',
  'numberChildrenForFullDay',
  'numberChildrenForHalfDay',
  'numberChildrenPerInfrastructure'
];

class EntryProperties {
  @tracked value;
  @tracked oldValue;

  constructor(value, predicate) {
    this.value = value;
    this.oldValue = value;
    this.predicate = predicate;
  }
}

class ApplicationFormEntry {
  @tracked applicationFormEntrySubject;
  @tracked errors = [];

  get totalAmount() {
    return this.numberChildrenForFullDay.value*20 +
           this.numberChildrenForHalfDay.value*10 +
           this.numberChildrenPerInfrastructure.value*10;
  }

  constructor({
    applicationFormEntrySubject,
    actorName,
    numberChildrenForFullDay,
    numberChildrenForHalfDay,
    numberChildrenPerInfrastructure,
    errors
  }) {
    this.applicationFormEntrySubject = applicationFormEntrySubject;

    this.actorName = new EntryProperties(actorName, actorNamePredicate);
    this.numberChildrenForFullDay = new EntryProperties(numberChildrenForFullDay, numberChildrenForFullDayPredicate);
    this.numberChildrenForHalfDay = new EntryProperties(numberChildrenForHalfDay, numberChildrenForHalfDayPredicate);
    this.numberChildrenPerInfrastructure = new EntryProperties(numberChildrenPerInfrastructure, numberChildrenPerInfrastructurePredicate);

    this.errors = errors;
  }
}

export default class CustomSubsidyFormFieldsApplicationFormTableEditComponent extends InputFieldComponent {
  @tracked applicationFormTableSubject = null
  @tracked entries = []

  constructor() {
    super(...arguments);
    this.loadProvidedValue();
  }

  get aangevraagdBedrag() {
    let total = 0;
    this.entries.forEach(entry => {
      total += entry.totalAmount;
    });
    return total;
  }

  get hasApplicationFormTable() {
    if (!this.applicationFormTableSubject)
      return false;
    else
      return this.storeOptions.store.match(this.sourceNode,
                                           applicationFormTablePredicate,
                                           this.applicationFormTableSubject,
                                           this.storeOptions.sourceGraph).length > 0;
  }

  get hasEntries() {
    return this.storeOptions.store.match(this.applicationFormTableSubject,
                                         applicationFormEntryPredicate,
                                         undefined,
                                         this.storeOptions.sourceGraph).length > 0;
  }

  loadProvidedValue() {
    const matches = triplesForPath(this.storeOptions);
    const triples =  matches.triples;

    if (triples.length) {
      this.applicationFormTableSubject = triples[0].object; // assuming only one per form

      const entriesMatches = triplesForPath({
        store: this.storeOptions.store,
        path: applicationFormEntryPredicate,
        formGraph: this.storeOptions.formGraph,
        sourceNode: this.applicationFormTableSubject,
        sourceGraph: this.storeOptions.sourceGraph
      });
      const entriesTriples = entriesMatches.triples;

      if (entriesTriples.length > 0) {
        for (let entry of entriesTriples) {
          const entryProperties = this.storeOptions.store.match(entry.object,
                                         undefined,
                                         undefined,
                                         this.storeOptions.sourceGraph);

          const parsedEntry = this.parseEntryProperties(entryProperties);

          this.entries.pushObject(new ApplicationFormEntry({
            applicationFormEntrySubject: entry.object,
            actorName: parsedEntry.actorName ? parsedEntry.actorName : "",
            numberChildrenForFullDay: parsedEntry.numberChildrenForFullDay ? parsedEntry.numberChildrenForFullDay : 0,
            numberChildrenForHalfDay: parsedEntry.numberChildrenForHalfDay ? parsedEntry.numberChildrenForHalfDay : 0,
            numberChildrenPerInfrastructure: parsedEntry.numberChildrenPerInfrastructure ? parsedEntry.numberChildrenPerInfrastructure : 0,
            errors: []
          }));
        }
      }
    }
  }

  /**
  * Parse entry properties from triples to a simple object with the triple values
  */
  parseEntryProperties(entryProperties) {
    let entry = {};
    if (entryProperties.find(entry => entry.predicate.value == actorNamePredicate.value))
      entry.actorName = entryProperties.find(
        entry => entry.predicate.value == actorNamePredicate.value
      ).object.value;
    if (entryProperties.find(entry => entry.predicate.value == numberChildrenForFullDayPredicate.value))
      entry.numberChildrenForFullDay = entryProperties.find(
        entry => entry.predicate.value == numberChildrenForFullDayPredicate.value
      ).object.value;
    if (entryProperties.find(entry => entry.predicate.value == numberChildrenForHalfDayPredicate.value))
      entry.numberChildrenForHalfDay = entryProperties.find(
        entry => entry.predicate.value == numberChildrenForHalfDayPredicate.value
      ).object.value;
    if (entryProperties.find(entry => entry.predicate.value == numberChildrenPerInfrastructurePredicate.value))
      entry.numberChildrenPerInfrastructure = entryProperties.find(
        entry => entry.predicate.value == numberChildrenPerInfrastructurePredicate.value
      ).object.value;
    return entry;
  }

  createApplicationFormTable() {
    const uuid = uuidv4();
    this.applicationFormTableSubject = new rdflib.NamedNode(`${applicationFormTableBaseUri}/${uuid}`);
    const triples = [ { subject: this.applicationFormTableSubject,
                        predicate: RDF('type'),
                        object: ApplicationFormTableType,
                        graph: this.storeOptions.sourceGraph
                      },
                      { subject: this.applicationFormTableSubject,
                        predicate: MU('uuid'),
                        object: uuid,
                        graph: this.storeOptions.sourceGraph
                      },
                      { subject: this.storeOptions.sourceNode,
                        predicate: applicationFormTablePredicate,
                        object: this.applicationFormTableSubject,
                        graph: this.storeOptions.sourceGraph }
                    ];
    this.storeOptions.store.addAll(triples);
    super.updateValidations();
  }

  createApplicationFormEntry() {
    const uuid = uuidv4();
    const applicationFormEntrySubject = new rdflib.NamedNode(`${applicationFormEntryBaseUri}/${uuid}`);
    const triples = [ { subject: applicationFormEntrySubject,
                        predicate: RDF('type'),
                        object: ApplicationFormEntryType,
                        graph: this.storeOptions.sourceGraph
                      },
                      { subject: applicationFormEntrySubject,
                        predicate: MU('uuid'),
                        object: uuid,
                        graph: this.storeOptions.sourceGraph
                      },
                      { subject: this.applicationFormTableSubject,
                        predicate: applicationFormEntryPredicate,
                        object: applicationFormEntrySubject,
                        graph: this.storeOptions.sourceGraph }
                    ];
    this.storeOptions.store.addAll(triples);
    super.updateValidations();
    return applicationFormEntrySubject;
  }

  removeApplicationFormTable() {
    const applicationFormTableTriples = this.storeOptions.store.match(
      this.applicationFormTableSubject,
      undefined,
      undefined,
      this.storeOptions.sourceGraph
    );
    const triples = [
      ...applicationFormTableTriples,
      { subject: this.storeOptions.sourceNode,
        predicate: applicationFormTablePredicate,
        object: this.applicationFormTableSubject,
        graph: this.storeOptions.sourceGraph }
    ];
    this.storeOptions.store.removeStatements(triples);
  }

  removeEntryTriples(entry) {
    inputFieldNames.forEach(key => {
      const propertiesTriples = [
        {
          subject: entry.applicationFormEntrySubject,
          predicate: actorNamePredicate,
          object: entry[key].oldValue,
          graph: this.storeOptions.sourceGraph
        }
      ];
      this.storeOptions.store.removeStatements(propertiesTriples);
    })

    const entryTriples = [
      {
        subject: this.applicationFormTableSubject,
        predicate: applicationFormEntryPredicate,
        object: entry.applicationFormEntrySubject,
        graph: this.storeOptions.sourceGraph
      }
    ];
    this.storeOptions.store.removeStatements(entryTriples);
  }

  updateFieldValueTriple(entry, field) {
    const fieldValueTriples = this.storeOptions.store.match(
      entry.applicationFormEntrySubject,
      entry[field].predicate,
      undefined,
      this.storeOptions.sourceGraph
    );
    const triples = [
      ...fieldValueTriples
    ];
    this.storeOptions.store.removeStatements(triples);

    if (entry[field].value) {
      this.storeOptions.store.addAll([
        {
          subject: entry.applicationFormEntrySubject,
          predicate: entry[field].predicate,
          object: entry[field].value,
          graph: this.storeOptions.sourceGraph
        }
      ]);
    }
  }

  @action
  addEntry() {
    if (!this.hasApplicationFormTable)
      this.createApplicationFormTable();

    const applicationFormEntrySubject = this.createApplicationFormEntry();

    this.entries.pushObject(new ApplicationFormEntry({
      applicationFormEntrySubject,
      actorName: "",
      numberChildrenForFullDay: 0,
      numberChildrenForHalfDay: 0,
      numberChildrenPerInfrastructure: 0,
      errors: []
    }));
  }

  @action
  updateActorNameValue(entry) {
    entry.errors = [];
    this.updateFieldValueTriple(entry, 'actorName');
    if (this.isEmpty(entry.actorName.value)) {
      entry.errors.pushObject('Naam actor is verplicht');
    }
  }

  @action
  updateNumberChildrenForFullDayValue(entry) {
    entry.errors = [];
    const value = parseInt(entry.numberChildrenForFullDay.value) ? parseInt(entry.numberChildrenForFullDay.value) : entry.numberChildrenForFullDay.value;
    entry.numberChildrenForFullDay.value = value;
    this.updateFieldValueTriple(entry, 'numberChildrenForFullDay');
    if (this.isEmpty(entry.numberChildrenForFullDay.value)) {
      entry.errors.pushObject('Aantal kinderen voor alle volle dagen is verplicht');
    } else if (!this.isInteger(entry.numberChildrenForFullDay.value)) {
      entry.errors.pushObject('Aantal kinderen voor alle volle dagen is not een nummer.');
    }
  }

  @action
  updateNumberChildrenForHalfDayValue(entry) {
    entry.errors = [];
    entry.numberChildrenForHalfDay.value = parseInt(entry.numberChildrenForHalfDay.value) ? parseInt(entry.numberChildrenForHalfDay.value) : entry.numberChildrenForHalfDay.value;
    this.updateFieldValueTriple(entry, 'numberChildrenForHalfDay');
    if (this.isEmpty(entry.numberChildrenForHalfDay.value)) {
      entry.errors.pushObject('Aantal kinderen voor alle halve dagen is verplicht');
    } else if (!this.isInteger(entry.numberChildrenForHalfDay.value)) {
      entry.errors.pushObject('Aantal kinderen voor alle halve dagen is not een nummer.');
    }
  }

  @action
  updateNumberChildrenPerInfrastructureValue(entry) {
    entry.errors = [];
    entry.numberChildrenPerInfrastructure.value = parseInt(entry.numberChildrenPerInfrastructure.value) ? parseInt(entry.numberChildrenPerInfrastructure.value) : entry.numberChildrenPerInfrastructure.value;
    this.updateFieldValueTriple(entry, 'numberChildrenPerInfrastructure');
    if (this.isEmpty(entry.numberChildrenPerInfrastructure.value)) {
      entry.errors.pushObject('Aantal kinderen per infrastructuur per dag is verplicht');
    } else if (!this.isInteger(entry.numberChildrenPerInfrastructure.value)) {
      entry.errors.pushObject('Aantal kinderen per infrastructuur per dag is not een nummer.');
    }
  }

  @action
  removeEntry(entry) {
    if (this.applicationFormTableSubject) {
      this.removeEntryTriples(entry);

      if (!this.hasEntries)
        this.removeApplicationFormTable();
    }

    this.entries.removeObject(entry);

    this.hasBeenFocused = true;
    super.updateValidations(); // update validation of the general field
  }

  isEmpty(value) {
    return value.toString().length == 0;
  }

  isInteger(value) {
    return value === parseInt(value);
  }
}
