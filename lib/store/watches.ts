import { TextEditor, CompositeDisposable } from "atom";
import { action, observable } from "mobx";
import SelectListView from "atom-select-list";
import WatchStore from "./watch";
import AutocompleteConsumer from "../services/consumed/autocomplete";
import { setPreviouslyFocusedElement } from "../utils";
import type Kernel from "../kernel";

interface SelectListItem {
  name: string;
  value: number;
}

export default class WatchesStore {
  kernel: Kernel;
  @observable
  watches: Array<WatchStore> = [];
  autocompleteDisposables: CompositeDisposable | null | undefined;
  previouslyFocusedElement: HTMLElement | null | undefined;

  constructor(kernel: Kernel) {
    this.kernel = kernel;
    this.kernel.addWatchCallback(this.run);

    if (AutocompleteConsumer.isEnabeled) {
      const disposable = new CompositeDisposable();
      this.autocompleteDisposables = disposable;
      AutocompleteConsumer.register(disposable);
    }

    this.addWatch();
  }

  @action
  createWatch = () => {
    const lastWatch = this.watches[this.watches.length - 1];

    if (!lastWatch || lastWatch.getCode().trim() !== "") {
      const watch = new WatchStore(this.kernel);
      this.watches.push(watch);
      if (AutocompleteConsumer.isEnabeled) {
        AutocompleteConsumer.addAutocompleteToWatch(this, watch);
      }
      return watch;
    }

    return lastWatch;
  };
  @action
  addWatch = () => {
    this.createWatch().focus();
  };
  @action
  addWatchFromEditor = (editor: TextEditor) => {
    if (!editor) {
      return;
    }
    const watchText = editor.getSelectedText();

    if (!watchText) {
      this.addWatch();
    } else {
      const watch = this.createWatch();
      watch.setCode(watchText);
      watch.run();
    }
  };
  @action
  removeWatch = () => {
    const watches = this.watches
      .map((v, k) => ({
        name: v.getCode(),
        value: k,
      }))
      .filter((obj) => obj.value !== 0 || obj.name !== "");
    const watchesPicker = new SelectListView({
      items: watches as SelectListItem[],
      elementForItem: (watch: SelectListItem) => {
        const element = document.createElement("li");
        element.textContent = watch.name || "<empty>";
        return element;
      },
      didConfirmSelection: (watch: SelectListItem) => {
        const selectedWatch = this.watches[watch.value];
        // This is for cleanup to improve performance
        if (AutocompleteConsumer.isEnabeled) {
          AutocompleteConsumer.removeAutocompleteFromWatch(this, selectedWatch);
        }
        this.watches.splice(watch.value, 1);
        modalPanel.destroy();
        watchesPicker.destroy();
        if (this.watches.length === 0) {
          this.addWatch();
        } else if (this.previouslyFocusedElement) {
          this.previouslyFocusedElement.focus();
        }
      },
      filterKeyForItem: (watch: SelectListItem) => watch.name,
      didCancelSelection: () => {
        modalPanel.destroy();
        if (this.previouslyFocusedElement) {
          this.previouslyFocusedElement.focus();
        }
        watchesPicker.destroy();
      },
      emptyMessage: "There are no watches to remove!",
    });
    setPreviouslyFocusedElement(this);
    const modalPanel = atom.workspace.addModalPanel({
      item: watchesPicker,
    });
    watchesPicker.focus();
  };
  @action
  run = () => {
    this.watches.forEach((watch) => watch.run());
  };

  destroy() {
    if (AutocompleteConsumer.isEnabeled && this.autocompleteDisposables) {
      AutocompleteConsumer.dispose(this.autocompleteDisposables);
    }
  }
}
