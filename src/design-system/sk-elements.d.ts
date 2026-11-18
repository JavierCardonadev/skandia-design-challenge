import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/**
 * JSX typings for the Skandia `sk-*` custom elements documented in the kit.
 * Only the attributes this app uses are declared; extend them as wrappers grow.
 */
type SkElement<Attributes = object> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> &
  Attributes;

type SkFeedbackTone = 'info' | 'success' | 'warning' | 'error';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sk-logo': SkElement<{
        variant?: 'logo' | 'isotipo' | 'isotipo-simple';
        'sk-style'?: 'color' | 'verde' | 'negro' | 'blanco';
        decorativo?: boolean;
      }>;
      'sk-button': SkElement<{
        label?: string;
        'sk-type'?: 'primary' | 'secondary' | 'tertiary';
        size?: 'large' | 'small';
        icon?: string;
        'icon-pos'?: 'left' | 'right';
        disabled?: boolean;
        loading?: boolean;
        type?: 'button' | 'submit' | 'reset';
      }>;
      'sk-textarea': SkElement<{
        label?: string;
        value?: string;
        placeholder?: string;
        'help-text'?: string;
        'error-message'?: string;
        'auto-resize'?: boolean;
        disabled?: boolean;
      }>;
      'sk-input-text': SkElement<{
        label?: string;
        value?: string;
        'help-text'?: string;
        'error-message'?: string;
      }>;
      'sk-card': SkElement<{ header?: string; subheader?: string }>;
      'sk-alert': SkElement<{
        type?: SkFeedbackTone;
        message?: string;
        closable?: 'false';
      }>;
      'sk-tag': SkElement<{ 'sk-style'?: SkFeedbackTone; size?: 'large' | 'small' }>;
    }
  }
}
