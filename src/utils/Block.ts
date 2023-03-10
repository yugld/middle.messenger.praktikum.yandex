import { nanoid } from 'nanoid';
import { EventBus } from './EventBus';

abstract class Block<Props extends Record<string, any> = unknown> {
  static EVENTS = {
    INIT: 'init',
    FLOW_CDM: 'flow:component-did-mount',
    FLOW_CDU: 'flow:component-did-update',
    FLOW_RENDER: 'flow:render',
  };

  public _id = nanoid(6);

  protected props: Props;

  private eventBus: () => EventBus;

  protected _element: HTMLElement | null = null;

  private _meta: { props: any };

  protected children: Record<string, Block> | Record<string, Block[]>;

  /** JSDoc
   *
   * @param {Object} propsWithChildren
   *
   * @returns {void}
   */
  constructor(propsWithChildren: any = {}) {
    const eventBus = new EventBus();

    const { props, children } = this._getChildrenAndProps(propsWithChildren);

    this._meta = {
      props,
    };

    this.children = children;

    this.props = this._makePropsProxy(props);

    this.eventBus = () => eventBus;

    this._registerEvents(eventBus);

    eventBus.emit(Block.EVENTS.INIT);
  }

  private _getChildrenAndProps(childrenAndProps: any) {
    const props: Record<string, any> = {};
    const children: Record<string, Block> | Record<string, Block[]> = {};

    Object.entries(childrenAndProps).forEach(([key, value]) => {
      if (value instanceof Array) {
        value.forEach((val) => {
          if (val instanceof Block) {
            children[key] = value;
          }
        });
      } else if (value instanceof Block) {
        children[key] = value;
      } else {
        props[key] = value;
      }
    });

    return { props, children };
  }

  private _registerEvents(eventBus: EventBus) {
    eventBus.on(Block.EVENTS.INIT, this._init.bind(this));
    eventBus.on(Block.EVENTS.FLOW_CDM, this._componentDidMount.bind(this));
    eventBus.on(Block.EVENTS.FLOW_CDU, this._componentDidUpdate.bind(this));
    eventBus.on(Block.EVENTS.FLOW_RENDER, this._render.bind(this));
  }

  private _createResources() {}

  private _init() {
    this._createResources();

    this.init();

    this.eventBus().emit(Block.EVENTS.FLOW_RENDER);
  }

  init() {}

  private _componentDidMount() {
    this.componentDidMount();
    this.eventBus().emit(Block.EVENTS.FLOW_RENDER);
  }

  componentDidMount() {}

  public dispatchComponentDidMount() {
    this.eventBus().emit(Block.EVENTS.FLOW_CDM);
  }

  private _componentDidUpdate(oldProps: any, newProps: any) {
    const response = this.componentDidUpdate(oldProps, newProps);
    if (response) {
      this.eventBus().emit(Block.EVENTS.FLOW_RENDER);
    }
  }

  protected componentDidUpdate(oldProps?: any, newProps?: any) {
    return oldProps !== newProps;
  }

  setProps = (nextProps: any) => {
    if (!nextProps) {
      return;
    }

    Object.assign(this.props, nextProps);
    this.eventBus().emit(Block.EVENTS.FLOW_RENDER);
  };

  get element() {
    return this._element;
  }

  private _render() {
    const fragment = this.render();

    const newElement = fragment.firstElementChild as HTMLElement;

    if (this._element) {
      this._removeEvents();
      this._element.replaceWith(newElement);
    }

    this._element = newElement;

    this._addEvents();
    this._addClass();
  }

  protected compile(template: (context: any) => string, context: any) {
    const contextAndStubs = { ...context };

    Object.entries(this.children).forEach(([name, component]) => {
      if (Array.isArray(component)) {
        component.forEach((val) => {
          if (!contextAndStubs[name]) {
            contextAndStubs[name] = `<div data-id='${val._id}'></div>`;
          } else {
            contextAndStubs[
              name
            ] = `${contextAndStubs[name]}<div data-id='${val._id}'></div>`;
          }
        });
        return;
      }

      contextAndStubs[name] = `<div data-id='${component._id}'></div>`;
    });

    const html = template(contextAndStubs);

    const temp = document.createElement('template');

    temp.innerHTML = html;

    Object.entries(this.children).forEach(([, component]) => {
      let stub;
      if (Array.isArray(component)) {
        component.forEach((val) => {
          stub = temp.content.querySelector(`[data-id='${val._id}']`);
          if (!stub) {
            return;
          }

          stub.replaceWith(val.getContent()!);
        });
      } else {
        stub = temp.content.querySelector(`[data-id='${component._id}']`);
        if (!stub) {
          return;
        }

        stub.replaceWith(component.getContent()!);
      }
    });

    return temp.content;
  }

  protected render(): DocumentFragment {
    return new DocumentFragment();
  }

  getContent() {
    return this.element;
  }

  private _makePropsProxy(props: any) {
    return new Proxy(props, {
      get(target, prop) {
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set: (target, prop, value) => {
        const oldTarget = { ...target };
        target[prop] = value;

        this.eventBus().emit(Block.EVENTS.FLOW_CDU, oldTarget, target);
        return true;
      },
      deleteProperty() {
        throw new Error('?????? ??????????????');
      },
    });
  }

  private _createDocumentElement(tagName: string) {
    return document.createElement(tagName);
  }

  show() {
    this.getContent()!.style.display = 'block';
  }

  hide() {
    this.getContent()!.style.display = 'none';
  }

  private _addEvents() {
    const { events = {} } = this.props as {
      events: Record<string, () => void>;
    };

    Object.keys(events).forEach((eventName) => {
      this._element?.addEventListener(eventName, events[eventName]);
    });
  }

  private _addClass() {
    const { classes = '' } = this.props as { classes: string };
    if (!classes) {
      return;
    }

    const arr = classes.split(' ');
    arr.forEach((className) => {
      this._element!.classList.add(className);
    });
  }

  private _removeEvents() {
    const { events = {} } = this.props as {
      events: Record<string, () => void>;
    };

    Object.keys(events).forEach((eventName) => {
      this._element!.removeEventListener(eventName, events[eventName]);
    });
  }
}

export default Block;
